import logging
import webbrowser
from urllib.parse import quote_plus
from typing import Dict, Any
from .allowlist import allowlist
from ..config import get_sites_mapping

logger = logging.getLogger("Snowman.BrowserControl")


class BrowserControl:
    """Handles browser operations: opening sites, search, and URL navigation."""

    @staticmethod
    def open_website(url: str) -> Dict[str, Any]:
        url = url.strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            url = f"https://{url}"

        if not allowlist.check_url(url):
            return {
                "status": "blocked",
                "message": f"Opening this website is not permitted by your safety allowlist: {url}",
                "url": url
            }

        try:
            logger.info(f"Opening URL in default browser: {url}")
            webbrowser.open(url)
            return {
                "status": "success",
                "message": f"Opened website: {url}",
                "url": url
            }
        except Exception as e:
            logger.error(f"Failed to open website '{url}': {e}")
            return {
                "status": "error",
                "message": f"Failed to open website: {str(e)}",
                "url": url
            }

    @staticmethod
    def web_search(query: str) -> Dict[str, Any]:
        query = query.strip()
        if not allowlist.check_search_allowed():
            return {
                "status": "blocked",
                "message": "Web search is disabled in your safety settings.",
                "query": query
            }

        try:
            search_url = f"https://www.google.com/search?q={quote_plus(query)}"
            logger.info(f"Performing web search: '{query}' -> {search_url}")
            webbrowser.open(search_url)
            return {
                "status": "success",
                "message": f"Searching the web for '{query}'",
                "query": query,
                "url": search_url
            }
        except Exception as e:
            logger.error(f"Failed to perform web search for '{query}': {e}")
            return {
                "status": "error",
                "message": f"Failed to execute web search: {str(e)}",
                "query": query
            }

    @staticmethod
    def open_specific_site(site_name: str) -> Dict[str, Any]:
        site_key = site_name.strip().lower()
        sites_map = get_sites_mapping()

        if site_key in sites_map:
            target_url = sites_map[site_key]
            return BrowserControl.open_website(target_url)

        # Fuzzy lookup
        for key, url in sites_map.items():
            if site_key in key or key in site_key:
                return BrowserControl.open_website(url)

        # Fallback to constructing domain
        constructed_url = f"https://www.{site_key}.com"
        return BrowserControl.open_website(constructed_url)


browser_controller = BrowserControl()
