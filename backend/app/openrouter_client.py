import logging
import os
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-20b:free"
FALLBACK_OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it:free"
CONNECTIVITY_PROMPT = "What is 2+2? Reply with just the answer."


class OpenRouterConfigError(RuntimeError):
  pass


class OpenRouterUpstreamError(RuntimeError):
  pass


class OpenRouterHTTPStatusError(OpenRouterUpstreamError):
  def __init__(self, status_code: int, message: str):
    super().__init__(message)
    self.status_code = status_code


def _extract_text(content: Any) -> str:
  if isinstance(content, str):
    return content.strip()

  if isinstance(content, list):
    chunks: list[str] = []
    for item in content:
      if isinstance(item, dict) and item.get("type") == "text":
        text = item.get("text")
        if isinstance(text, str) and text.strip():
          chunks.append(text.strip())
    return "\n".join(chunks)

  return ""


def _get_api_key(env_var_name: str) -> str:
  api_key = os.getenv(env_var_name, "").strip()
  if not api_key:
    raise OpenRouterConfigError(f"{env_var_name} is not configured.")
  return api_key


def _post_chat_completion(
  *,
  model: str,
  api_key_env_var: str,
  messages: list[dict[str, str]],
  response_format: dict[str, str] | None = None,
) -> str:
  api_key = _get_api_key(api_key_env_var)
  headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
  }
  payload = {
    "model": model,
    "messages": messages,
  }
  if response_format is not None:
    payload["response_format"] = response_format

  try:
    response = httpx.post(OPENROUTER_URL, headers=headers, json=payload, timeout=20.0)
  except httpx.HTTPError as exc:
    logging.warning("OpenRouter request failed: %s", exc)
    raise OpenRouterUpstreamError("OpenRouter request failed.") from exc

  if response.status_code >= 400:
    body_preview = response.text[:200]
    logging.warning(
      "OpenRouter returned status %s for model %s: %s",
      response.status_code,
      model,
      body_preview,
    )
    raise OpenRouterHTTPStatusError(
      response.status_code,
      f"OpenRouter returned status {response.status_code}.",
    )

  data = response.json()
  content = (
    data.get("choices", [{}])[0]
    .get("message", {})
    .get("content")
  )
  answer = _extract_text(content)
  if not answer:
    logging.warning("OpenRouter response did not include assistant content.")
    raise OpenRouterUpstreamError(
      "OpenRouter response did not include assistant content."
    )

  return answer


def _complete_with_fallback(
  messages: list[dict[str, str]],
  response_format: dict[str, str] | None = None,
) -> tuple[str, str]:
  """Call the primary model, falling back to the secondary one on a 429."""
  primary_model = os.getenv("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL)

  try:
    answer = _post_chat_completion(
      model=primary_model,
      api_key_env_var="OPENROUTER_API_KEY",
      messages=messages,
      response_format=response_format,
    )
    return primary_model, answer
  except OpenRouterHTTPStatusError as exc:
    if exc.status_code != 429:
      raise

  if not os.getenv("OPENROUTER_API_KEY_2", "").strip():
    raise OpenRouterUpstreamError(
      "OpenRouter returned status 429 and OPENROUTER_API_KEY_2 is not configured."
    )

  logging.warning(
    "OpenRouter primary model %s was rate-limited (429). Retrying with fallback model %s.",
    primary_model,
    FALLBACK_OPENROUTER_MODEL,
  )
  fallback_answer = _post_chat_completion(
    model=FALLBACK_OPENROUTER_MODEL,
    api_key_env_var="OPENROUTER_API_KEY_2",
    messages=messages,
    response_format=response_format,
  )
  return FALLBACK_OPENROUTER_MODEL, fallback_answer


def run_structured_chat(messages: list[dict[str, str]]) -> tuple[str, str]:
  return _complete_with_fallback(messages, {"type": "json_object"})


def run_connectivity_check() -> tuple[str, str]:
  return _complete_with_fallback([{"role": "user", "content": CONNECTIVITY_PROMPT}])