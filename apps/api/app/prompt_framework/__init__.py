"""Prompt framework admin package."""
from app.prompt_framework.config_loader import (
    get_framework_config,
    get_category_configs,
    get_sector_configs,
    get_core_templates_for_sector,
    get_all_core_templates,
    get_strategic_configs,
    get_scoring_weights,
)

__all__ = [
    "get_framework_config",
    "get_category_configs",
    "get_sector_configs",
    "get_core_templates_for_sector",
    "get_all_core_templates",
    "get_strategic_configs",
    "get_scoring_weights",
]
