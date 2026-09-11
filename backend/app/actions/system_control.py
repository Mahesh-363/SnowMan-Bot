import os
import sys
import psutil
import datetime
import logging
import platform
import subprocess
from typing import Dict, Any, Optional

from .allowlist import allowlist
from .browser_control import browser_controller

logger = logging.getLogger("Snowman.SystemControl")


class SystemControl:
    """Handles Windows application launching, termination, and system metrics reporting."""

    @staticmethod
    def open_application(app_name: str) -> Dict[str, Any]:
        is_allowed, target_exec = allowlist.check_application(app_name)
        if not is_allowed or not target_exec:
            return {
                "status": "blocked",
                "message": f"Opening '{app_name}' is not permitted by your safety allowlist.",
                "app_name": app_name
            }

        try:
            logger.info(f"Opening application: {target_exec} (requested as '{app_name}')")
            if sys.platform == "win32":
                try:
                    os.startfile(target_exec)
                except Exception:
                    # Fallback to subprocess / cmd.exe start
                    subprocess.Popen(target_exec, shell=True)
            else:
                subprocess.Popen([target_exec])

            return {
                "status": "success",
                "message": f"Opened {app_name}.",
                "app_name": app_name,
                "executable": target_exec
            }
        except Exception as e:
            logger.error(f"Failed to launch application '{app_name}': {e}")
            return {
                "status": "error",
                "message": f"Could not launch {app_name}: {str(e)}",
                "app_name": app_name
            }

    @staticmethod
    def close_application(app_name: str) -> Dict[str, Any]:
        target_name = app_name.strip().lower()
        terminated_count = 0

        # Safety check: Don't allow closing critical OS processes
        critical_processes = ["system", "explorer.exe", "svchost.exe", "winlogon.exe", "csrss.exe"]
        if target_name in critical_processes:
            return {
                "status": "blocked",
                "message": f"Cannot close critical system process '{app_name}'.",
                "app_name": app_name
            }

        try:
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    proc_name = (proc.info['name'] or '').lower()
                    if target_name in proc_name:
                        proc.terminate()
                        terminated_count += 1
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue

            if terminated_count > 0:
                return {
                    "status": "success",
                    "message": f"Closed {terminated_count} instance(s) of {app_name}.",
                    "app_name": app_name
                }
            else:
                return {
                    "status": "not_found",
                    "message": f"No running application matching '{app_name}' was found.",
                    "app_name": app_name
                }
        except Exception as e:
            logger.error(f"Error terminating process '{app_name}': {e}")
            return {
                "status": "error",
                "message": f"Error closing {app_name}: {str(e)}",
                "app_name": app_name
            }

    @staticmethod
    def system_info() -> Dict[str, Any]:
        try:
            now = datetime.datetime.now().strftime("%I:%M %p, %A, %B %d")
            cpu_pct = psutil.cpu_percent(interval=0.1)
            mem = psutil.virtual_memory()
            mem_pct = mem.percent

            battery_info = "No battery detected"
            battery = psutil.sensors_battery()
            if battery is not None:
                plugged_str = "plugged in" if battery.power_plugged else "on battery"
                battery_info = f"{int(battery.percent)}% ({plugged_str})"

            os_info = f"{platform.system()} {platform.release()}"

            summary = (
                f"The current time is {now}. CPU usage is at {cpu_pct}%, memory is at {mem_pct}%, "
                f"and your battery is at {battery_info}."
            )

            return {
                "status": "success",
                "message": summary,
                "data": {
                    "time": now,
                    "cpu_percent": cpu_pct,
                    "memory_percent": mem_pct,
                    "battery": battery_info,
                    "os": os_info
                }
            }
        except Exception as e:
            logger.error(f"Error gathering system info: {e}")
            return {
                "status": "error",
                "message": f"Could not retrieve full system statistics: {str(e)}"
            }


async def execute_tool(tool_name: str, tool_args: Dict[str, Any]) -> Dict[str, Any]:
    """Unified asynchronous dispatcher for web assistant tools."""
    logger.info(f"Executing tool: {tool_name} with args: {tool_args}")
    
    if tool_name == "open_website":
        url = tool_args.get("url", "")
        return browser_controller.open_website(url)

    elif tool_name == "open_specific_site":
        site_name = tool_args.get("site_name", "")
        return browser_controller.open_specific_site(site_name)

    elif tool_name == "web_search":
        query = tool_args.get("query", "")
        return browser_controller.web_search(query)

    elif tool_name in ("open_application", "close_application", "system_info"):
        return {
            "status": "info",
            "message": f"Desktop system actions are disabled in the web edition. You can ask me to open websites, search the web, or answer any questions!"
        }

    else:
        return {
            "status": "unknown_tool",
            "message": f"I don't know how to execute the tool '{tool_name}'."
        }
