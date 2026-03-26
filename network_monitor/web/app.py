"""
FastAPI Web サーバー
ブラウザからネットワーク監視ダッシュボードにアクセスできるようにする
"""
import asyncio
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ..scanner import arp_scan, get_local_network
from ..monitor import (
    get_active_connections,
    get_external_connections,
    get_listening_ports,
    get_connection_stats,
)
from ..threat_intel import check_ip_reputation, check_multiple_ips
from ..detector import (
    AlertLevel,
    NewDeviceDetector,
    ConnectionAnomalyDetector,
)

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"


def create_app(config: dict) -> FastAPI:
    app = FastAPI(title="ホームネットワークセキュリティモニター", version="1.0.0")

    # 状態管理
    state: dict[str, Any] = {
        "config": config,
        "devices": [],
        "connections": [],
        "ports": [],
        "alerts": [],
        "last_scan": None,
        "scanning": False,
        "monitoring": False,
    }

    device_detector = NewDeviceDetector(
        known_macs={d.get("mac", "").lower() for d in config.get("known_devices", [])}
    )
    conn_detector = ConnectionAnomalyDetector(
        max_connections_per_ip=config.get("thresholds", {}).get("max_connections_per_ip", 20)
    )

    # WebSocket 接続管理
    active_websockets: list[WebSocket] = []

    async def broadcast(event: str, data: Any) -> None:
        msg = json.dumps({"event": event, "data": data, "ts": datetime.now().isoformat()})
        dead = []
        for ws in active_websockets:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            active_websockets.remove(ws)

    # ------------------------------------------------------------------ #
    # 静的ファイル & HTML                                                  #
    # ------------------------------------------------------------------ #
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/", response_class=HTMLResponse)
    async def index():
        html_file = STATIC_DIR / "index.html"
        return HTMLResponse(html_file.read_text(encoding="utf-8"))

    # ------------------------------------------------------------------ #
    # REST API エンドポイント                                               #
    # ------------------------------------------------------------------ #

    @app.get("/api/status")
    async def api_status():
        return {
            "scanning": state["scanning"],
            "monitoring": state["monitoring"],
            "last_scan": state["last_scan"],
            "alert_count": len(state["alerts"]),
            "device_count": len(state["devices"]),
        }

    @app.post("/api/scan")
    async def api_scan():
        """ネットワークスキャンを実行する"""
        if state["scanning"]:
            return JSONResponse({"error": "スキャン中です"}, status_code=409)

        async def run_scan():
            state["scanning"] = True
            await broadcast("scan_started", {})
            try:
                network = config.get("network") or get_local_network()
                loop = asyncio.get_event_loop()
                devices = await loop.run_in_executor(None, arp_scan, network)

                new_alerts = []
                for d in devices:
                    alert = device_detector.check_device(d.mac, d.ip, d.hostname)
                    if alert:
                        alert_data = _alert_to_dict(alert)
                        state["alerts"].insert(0, alert_data)
                        new_alerts.append(alert_data)

                state["devices"] = [
                    {"ip": d.ip, "mac": d.mac, "hostname": d.hostname}
                    for d in devices
                ]
                state["last_scan"] = datetime.now().isoformat()

                await broadcast("scan_complete", {
                    "devices": state["devices"],
                    "new_alerts": new_alerts,
                    "network": network,
                })
            except Exception as e:
                logger.error(f"スキャンエラー: {e}")
                await broadcast("scan_error", {"message": str(e)})
            finally:
                state["scanning"] = False

        asyncio.create_task(run_scan())
        return {"message": "スキャン開始"}

    @app.get("/api/devices")
    async def api_devices():
        return {"devices": state["devices"]}

    @app.get("/api/connections")
    async def api_connections():
        """現在の外部接続を取得する"""
        loop = asyncio.get_event_loop()
        connections = await loop.run_in_executor(None, get_active_connections)
        ext_connections = get_external_connections(connections)

        api_key = config.get("abuseipdb_api_key", "")
        ext_ips = list({c.remote_ip for c in ext_connections})

        ip_reps: dict[str, dict] = {}
        if ext_ips:
            ip_reps = await loop.run_in_executor(
                None, check_multiple_ips, ext_ips[:20], api_key
            )

        conn_alerts = conn_detector.analyze_connections(connections)
        for alert in conn_alerts:
            ad = _alert_to_dict(alert)
            if not any(a["description"] == ad["description"] for a in state["alerts"][:10]):
                state["alerts"].insert(0, ad)

        result = []
        for c in ext_connections:
            rep = ip_reps.get(c.remote_ip, {})
            result.append({
                "local_ip": c.local_ip,
                "local_port": c.local_port,
                "remote_ip": c.remote_ip,
                "remote_port": c.remote_port,
                "status": c.status,
                "process": c.process_name,
                "is_suspicious": c.is_suspicious,
                "alert_reason": c.alert_reason,
                "reputation": {
                    "is_malicious": rep.get("is_malicious", False),
                    "is_suspicious": rep.get("is_suspicious", False),
                    "country": rep.get("country", ""),
                    "detail": rep.get("detail", ""),
                    "score": rep.get("confidence_score", 0),
                },
            })

        state["connections"] = result
        await broadcast("connections_updated", {"connections": result})
        return {"connections": result}

    @app.get("/api/ports")
    async def api_ports():
        """リスニングポートを取得する"""
        loop = asyncio.get_event_loop()
        ports = await loop.run_in_executor(None, get_listening_ports)
        state["ports"] = ports
        return {"ports": ports}

    @app.get("/api/alerts")
    async def api_alerts():
        return {"alerts": state["alerts"][:100]}

    @app.delete("/api/alerts")
    async def api_alerts_clear():
        state["alerts"].clear()
        conn_detector.reset_seen_alerts()
        await broadcast("alerts_cleared", {})
        return {"message": "アラートをクリアしました"}

    @app.get("/api/check-ip/{ip}")
    async def api_check_ip(ip: str):
        api_key = config.get("abuseipdb_api_key", "")
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, check_ip_reputation, ip, api_key)
        return result

    # ------------------------------------------------------------------ #
    # WebSocket                                                            #
    # ------------------------------------------------------------------ #

    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket):
        await ws.accept()
        active_websockets.append(ws)
        logger.info(f"WebSocket接続: {ws.client}")

        # 初期状態を送信
        await ws.send_text(json.dumps({
            "event": "init",
            "data": {
                "devices": state["devices"],
                "alerts": state["alerts"][:20],
                "last_scan": state["last_scan"],
            },
            "ts": datetime.now().isoformat(),
        }))

        try:
            # 定期的に接続情報を push する監視ループ
            monitor_task = asyncio.create_task(_monitor_loop(broadcast, state, config, conn_detector))

            while True:
                try:
                    msg = await asyncio.wait_for(ws.receive_text(), timeout=30)
                    data = json.loads(msg)
                    # クライアントからの ping に応答
                    if data.get("type") == "ping":
                        await ws.send_text(json.dumps({"event": "pong"}))
                except asyncio.TimeoutError:
                    # keepalive
                    await ws.send_text(json.dumps({"event": "keepalive"}))
        except (WebSocketDisconnect, Exception):
            pass
        finally:
            if ws in active_websockets:
                active_websockets.remove(ws)
            monitor_task.cancel()

    return app


async def _monitor_loop(broadcast, state, config, conn_detector):
    """接続情報を定期的に更新してブロードキャストする"""
    interval = config.get("monitor_interval", 10)
    while True:
        await asyncio.sleep(interval)
        try:
            loop = asyncio.get_event_loop()
            connections = await loop.run_in_executor(None, get_active_connections)
            ext = get_external_connections(connections)

            alerts = conn_detector.analyze_connections(connections)
            for alert in alerts:
                ad = _alert_to_dict(alert)
                state["alerts"].insert(0, ad)
                await broadcast("alert", ad)

            stats = get_connection_stats(connections)
            await broadcast("stats_updated", {
                "total": stats["total"],
                "external": stats["external"],
                "suspicious": stats["suspicious"],
                "established": stats["established"],
            })
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"監視ループエラー: {e}")


def _alert_to_dict(alert) -> dict:
    return {
        "level": alert.level.value,
        "title": alert.title,
        "description": alert.description,
        "source_ip": alert.source_ip,
        "target_ip": alert.target_ip,
        "timestamp": alert.timestamp.isoformat(),
        "details": alert.details,
    }
