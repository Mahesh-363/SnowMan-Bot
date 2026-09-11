import logging
from urllib.parse import urlparse
from typing import Tuple, Optional
from ..config import get_allowlist_config

logger = logging.getLogger("Snowman.Allowlist")


class SecurityAllowlist:
    """Enforces safety allowlists for applications and web domains."""

    @staticmethod
    def check_application(app_name: str) -> Tuple[bool, Optional[str]]:
        """
        Validates whether an application is permitted to run.
        Returns (is_allowed, executable_or_path).
        """
        config = get_allowlist_config()
        allowed_apps = config.get("allowed_applications", [])
        clean_name = app_name.strip().lower()

        for item in allowed_apps:
            alias = item.get("alias", "").lower()
            executable = item.get("executable", "").lower()
            
            # Match either exact alias, alias without extension, or substring
            if clean_name == alias or clean_name in alias or alias in clean_name:
                return True, item.get("executable")
            if clean_name == executable or clean_name in executable:
                return True, item.get("executable")

        logger.warning(f"Application '{app_name}' was blocked by safety allowlist.")
        return False, None

    @staticmethod
    def check_url(url: str) -> bool:
        """Validates whether a web URL belongs to an allowlisted domain."""
        config = get_allowlist_config()
        allowed_domains = config.get("allowed_domains", [])

        try:
            parsed = urlparse(url)
            domain = (parsed.hostname or "").lower()
            if not domain:
                # In case a naked domain was passed like 'youtube.com'
                domain = url.split("/")[0].lower()

            for allowed in allowed_domains:
                allowed_clean = allowed.lower().strip()
                if domain == allowed_clean or domain.endswith("." + allowed_clean):
                    return True

            logger.warning(f"URL '{url}' (domain: {domain}) was blocked by safety allowlist.")
            return False
        except Exception as e:
            logger.error(f"Error checking URL allowlist for '{url}': {e}")
            return False

    @staticmethod
    def check_search_allowed() -> bool:
        """Checks if web search queries are permitted."""
        config = get_allowlist_config()
        return config.get("allow_all_search_queries", True)


allowlist = SecurityAllowlist()
