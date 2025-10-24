"""
Model Factory - Creates LLM instances for different providers (Gemini, DeepSeek via OpenRouter)
"""

import logging
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)


def create_gemini_model(api_key: str, model_name: str = "gemini-1.5-flash", temperature: float = 0.7):
    """
    Create a Gemini LLM instance with fallback models.

    Args:
        api_key: Gemini API key
        model_name: Primary model name
        temperature: Response temperature

    Returns:
        ChatGoogleGenerativeAI instance
    """
    # Use more stable models, starting with proven ones
    model_names = [
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-1.5-lite',    # Stable but more expensive
        'gemini-1.0-pro',    # Very stable fallback
    ]

    for model in model_names:
        try:
            llm = ChatGoogleGenerativeAI(
                model=model,
                google_api_key=api_key,
                temperature=temperature,
                convert_system_message_to_human=True,
                # Add safety settings to prevent issues
                safety_settings=None,
                # Disable streaming to avoid response parsing issues
                streaming=False
            )
            logger.info(f"✅ Successfully initialized Gemini model: {model}")
            return llm
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize Gemini model {model}: {str(e)}")
            continue

    # Final fallback - should always work
    logger.warning("Using emergency fallback: gemini-1.0-pro")
    return ChatGoogleGenerativeAI(
        model='gemini-1.0-pro',
        google_api_key=api_key,
        temperature=temperature,
        convert_system_message_to_human=True,
        safety_settings=None,
        streaming=False
    )


def create_deepseek_model(api_key: str, model_name: str = "deepseek/deepseek-chat-v3-0324:free", temperature: float = 0.7):
    """
    Create a DeepSeek LLM instance via OpenRouter.
    
    Args:
        api_key: OpenRouter API key
        model_name: DeepSeek model name on OpenRouter
        temperature: Response temperature
        
    Returns:
        ChatOpenAI instance configured for OpenRouter
    """
    try:
        llm = ChatOpenAI(
            model=model_name,
            openai_api_key=api_key,
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=temperature,
            model_kwargs={}
        )
        logger.info(f"✅ Successfully initialized DeepSeek model: {model_name}")
        return llm
    except Exception as e:
        logger.error(f"❌ Failed to initialize DeepSeek model: {str(e)}")
        raise


def create_llm_from_key_type(
    api_key: str,
    key_type: str,
    temperature: float = 0.7
):
    """
    Create appropriate LLM based on key type.
    
    Args:
        api_key: API key for the provider
        key_type: Type of key ('gemini_api_key' or 'deepseek_v3_key')
        temperature: Response temperature
        
    Returns:
        LLM instance (ChatGoogleGenerativeAI or ChatOpenAI)
        
    Raises:
        ValueError: If key_type is not supported
    """
    if key_type == "gemini_api_key":
        return create_gemini_model(api_key, temperature=temperature)
    elif key_type == "deepseek_v3_key":
        return create_deepseek_model(api_key, temperature=temperature)
    else:
        raise ValueError(f"Unsupported key type: {key_type}. Supported types: 'gemini_api_key', 'deepseek_v3_key'")


__all__ = ['create_gemini_model', 'create_deepseek_model', 'create_llm_from_key_type']

