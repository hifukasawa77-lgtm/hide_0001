"""
攻撃検出器: ポートスキャン、DoS、不審なトラフィックパターンを検出する
"""
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Alert:
    level: AlertLevel
    title: str
    description: str
    source_ip: str = ""
    target_ip: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    details: dict = field(default_factory=dict)

    def __str__(self) -> str:
        ts = self.timestamp.strftime("%H:%M:%S")
        src = f" [{self.source_ip}]" if self.source_ip else ""
        return f"[{ts}] [{self.level.value.upper()}]{src} {self.title}: {self.description}"


class PortScanDetector:
    """
    ポートスキャン検出器。
    短時間に多数のポートへの接続試行があった場合にアラートを発する。
    """

    def __init__(self, port_threshold: int = 10, window_seconds: int = 10):
        self.port_threshold = port_threshold
        self.window_seconds = window_seconds
        # {source_ip: [(timestamp, port), ...]}
        self._connection_log: dict[str, list[tuple[float, int]]] = defaultdict(list)

    def record_connection(self, source_ip: str, dest_port: int) -> Optional[Alert]:
        """接続を記録し、ポートスキャンが検出されたらアラートを返す"""
        now = time.time()
        log = self._connection_log[source_ip]

        # 古いエントリを削除
        cutoff = now - self.window_seconds
        self._connection_log[source_ip] = [(ts, p) for ts, p in log if ts > cutoff]
        log = self._connection_log[source_ip]

        # 新しいエントリを追加
        log.append((now, dest_port))

        # ユニークポート数をチェック
        unique_ports = set(p for _, p in log)
        if len(unique_ports) >= self.port_threshold:
            alert = Alert(
                level=AlertLevel.CRITICAL,
                title="ポートスキャン検出",
                source_ip=source_ip,
                description=(
                    f"{self.window_seconds}秒間に{len(unique_ports)}個のポートへの"
                    f"接続試行を検出しました"
                ),
                details={
                    "scanned_ports": sorted(unique_ports),
                    "attempt_count": len(log),
                },
            )
            # 検出後はリセット (重複アラート防止)
            self._connection_log[source_ip] = []
            return alert
        return None

    def reset(self) -> None:
        self._connection_log.clear()


class NewDeviceDetector:
    """
    ネットワーク上の新しいデバイスを検出する。
    """

    def __init__(self, known_macs: set[str] | None = None):
        self._known_macs: set[str] = known_macs or set()
        self._seen_devices: dict[str, dict] = {}  # mac -> device info

    def check_device(self, mac: str, ip: str, hostname: str = "") -> Optional[Alert]:
        """新しいデバイスが検出されたらアラートを返す"""
        if mac in self._seen_devices:
            return None  # 既知

        self._seen_devices[mac] = {"ip": ip, "hostname": hostname}

        if mac.lower() in self._known_macs:
            # ホワイトリストに登録済み
            return None

        level = AlertLevel.WARNING
        desc = f"MACアドレス {mac} の新しいデバイスがネットワークに接続しました"
        if hostname:
            desc += f" (ホスト名: {hostname})"

        return Alert(
            level=level,
            title="新しいデバイスを検出",
            source_ip=ip,
            description=desc,
            details={"mac": mac, "ip": ip, "hostname": hostname},
        )

    def add_known_device(self, mac: str) -> None:
        self._known_macs.add(mac.lower())

    def mark_seen(self, mac: str, ip: str, hostname: str = "") -> None:
        """デバイスを既知として登録する (アラートなし)"""
        self._seen_devices[mac] = {"ip": ip, "hostname": hostname}


class ConnectionAnomalyDetector:
    """
    接続の異常パターンを検出する:
    - 特定IPからの大量接続 (DoS疑い)
    - 疑わしいポートへの接続
    - 既知の悪意あるIPへの接続
    """

    def __init__(self, max_connections_per_ip: int = 20):
        self.max_connections_per_ip = max_connections_per_ip
        self._alerts_sent: set[str] = set()  # 重複防止

    def analyze_connections(self, connections: list) -> list[Alert]:
        """接続リストを分析してアラートを生成する"""
        from .monitor import detect_high_connection_count

        alerts = []

        # 大量接続チェック
        high_count = detect_high_connection_count(connections, self.max_connections_per_ip)
        for ip, count in high_count:
            key = f"high_conn_{ip}"
            if key not in self._alerts_sent:
                alerts.append(Alert(
                    level=AlertLevel.WARNING,
                    title="大量接続を検出",
                    source_ip=ip,
                    description=f"IPアドレス {ip} から {count} 件の接続が確認されました",
                    details={"connection_count": count},
                ))
                self._alerts_sent.add(key)

        # 疑わしいポートへの接続チェック
        for conn in connections:
            if conn.is_suspicious and not _is_private_ip_str(conn.remote_ip):
                key = f"suspicious_port_{conn.remote_ip}_{conn.remote_port}"
                if key not in self._alerts_sent:
                    alerts.append(Alert(
                        level=AlertLevel.WARNING,
                        title="疑わしいポートへの接続",
                        source_ip=conn.local_ip,
                        target_ip=conn.remote_ip,
                        description=conn.alert_reason,
                        details={
                            "process": conn.process_name,
                            "remote": f"{conn.remote_ip}:{conn.remote_port}",
                        },
                    ))
                    self._alerts_sent.add(key)

        return alerts

    def check_malicious_ip(self, ip: str, threat_info: dict) -> Optional[Alert]:
        """脅威インテリジェンスの結果に基づいてアラートを生成する"""
        key = f"malicious_{ip}"
        if key in self._alerts_sent:
            return None

        if threat_info.get("is_malicious"):
            self._alerts_sent.add(key)
            score = threat_info.get("confidence_score", 0)
            country = threat_info.get("country", "不明")
            return Alert(
                level=AlertLevel.CRITICAL,
                title="悪意あるIPへの接続を検出",
                source_ip=ip,
                description=(
                    f"既知の悪意あるIP {ip} ({country}) への接続が確認されました。"
                    f"脅威スコア: {score}/100"
                ),
                details=threat_info,
            )
        elif threat_info.get("is_suspicious"):
            self._alerts_sent.add(key)
            return Alert(
                level=AlertLevel.WARNING,
                title="疑わしいIPへの接続",
                source_ip=ip,
                description=(
                    f"疑わしいIP {ip} への接続: {threat_info.get('detail', '')}"
                ),
                details=threat_info,
            )
        return None

    def reset_seen_alerts(self) -> None:
        """送信済みアラートをリセットする (定期リセット用)"""
        self._alerts_sent.clear()


def _is_private_ip_str(ip: str) -> bool:
    import ipaddress
    try:
        addr = ipaddress.IPv4Address(ip)
        return addr.is_private or addr.is_loopback
    except ValueError:
        return False
