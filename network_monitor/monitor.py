"""
接続モニター: psutilを使ってアクティブなネットワーク接続を監視する
"""
import ipaddress
import logging
import socket
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import psutil

logger = logging.getLogger(__name__)

# プライベートIPアドレス範囲
PRIVATE_NETWORKS = [
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv4Network("169.254.0.0/16"),
]

# 一般的な安全なポート (ホワイトリスト)
KNOWN_SAFE_PORTS = {
    80, 443,       # HTTP/HTTPS
    53,            # DNS
    123,           # NTP
    67, 68,        # DHCP
    5353,          # mDNS
    1900,          # SSDP/UPnP
}

# 疑わしいポート (既知の悪用ポート)
SUSPICIOUS_PORTS = {
    23: "Telnet (暗号化なし)",
    445: "SMB (ランサムウェアで悪用されることがある)",
    1433: "MSSQL",
    1434: "MSSQL UDP",
    3306: "MySQL",
    3389: "RDP (リモートデスクトップ)",
    4444: "Metasploit デフォルトポート",
    5900: "VNC",
    6667: "IRC (C2通信で悪用されることがある)",
    8080: "HTTPプロキシ",
    31337: "Back Orifice",
}


@dataclass
class Connection:
    local_ip: str
    local_port: int
    remote_ip: str
    remote_port: int
    status: str
    pid: Optional[int]
    process_name: str = ""
    first_seen: datetime = field(default_factory=datetime.now)
    last_seen: datetime = field(default_factory=datetime.now)
    is_suspicious: bool = False
    alert_reason: str = ""

    @property
    def key(self) -> tuple:
        return (self.local_ip, self.local_port, self.remote_ip, self.remote_port)

    def is_external(self) -> bool:
        """外部IPへの接続かどうか"""
        return not _is_private_ip(self.remote_ip)

    def suspicious_port_info(self) -> Optional[str]:
        """疑わしいポートの情報を返す"""
        return SUSPICIOUS_PORTS.get(self.remote_port) or SUSPICIOUS_PORTS.get(self.local_port)


def is_private_ip(ip: str) -> bool:
    return _is_private_ip(ip)


def _is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.IPv4Address(ip)
        return any(addr in net for net in PRIVATE_NETWORKS)
    except ValueError:
        return False


def get_process_name(pid: Optional[int]) -> str:
    """PIDからプロセス名を取得する"""
    if pid is None:
        return ""
    try:
        proc = psutil.Process(pid)
        return proc.name()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return ""


def get_active_connections() -> list[Connection]:
    """現在アクティブなネットワーク接続を取得する"""
    connections = []
    try:
        for conn in psutil.net_connections(kind="inet"):
            if conn.raddr and conn.raddr.ip:
                remote_ip = conn.raddr.ip
                remote_port = conn.raddr.port
                local_ip = conn.laddr.ip if conn.laddr else ""
                local_port = conn.laddr.port if conn.laddr else 0

                # ループバックアドレスはスキップ
                if remote_ip.startswith("127.") or remote_ip == "::1":
                    continue

                process_name = get_process_name(conn.pid)

                c = Connection(
                    local_ip=local_ip,
                    local_port=local_port,
                    remote_ip=remote_ip,
                    remote_port=remote_port,
                    status=conn.status or "UNKNOWN",
                    pid=conn.pid,
                    process_name=process_name,
                )

                # 疑わしいポートチェック
                port_info = c.suspicious_port_info()
                if port_info:
                    c.is_suspicious = True
                    c.alert_reason = f"疑わしいポート {remote_port}: {port_info}"

                connections.append(c)
    except psutil.AccessDenied:
        logger.warning("接続情報の取得に管理者権限が必要です")

    return connections


def get_external_connections(connections: list[Connection]) -> list[Connection]:
    """外部IPへの接続のみを返す"""
    return [c for c in connections if c.is_external()]


def get_listening_ports() -> list[dict]:
    """このホストでリスニング中のポート一覧を返す"""
    ports = []
    try:
        for conn in psutil.net_connections(kind="inet"):
            if conn.status == psutil.CONN_LISTEN:
                process_name = get_process_name(conn.pid)
                is_suspicious = conn.laddr.port in SUSPICIOUS_PORTS
                ports.append({
                    "port": conn.laddr.port,
                    "ip": conn.laddr.ip,
                    "pid": conn.pid,
                    "process": process_name,
                    "is_suspicious": is_suspicious,
                    "reason": SUSPICIOUS_PORTS.get(conn.laddr.port, ""),
                })
    except psutil.AccessDenied:
        logger.warning("ポート情報の取得に管理者権限が必要です")

    return sorted(ports, key=lambda x: x["port"])


def get_connection_stats(connections: list[Connection]) -> dict:
    """接続統計を集計する"""
    stats = {
        "total": len(connections),
        "external": 0,
        "suspicious": 0,
        "by_process": defaultdict(int),
        "by_remote_ip": defaultdict(int),
        "established": 0,
        "syn_sent": 0,
    }

    for c in connections:
        if c.is_external():
            stats["external"] += 1
        if c.is_suspicious:
            stats["suspicious"] += 1
        if c.process_name:
            stats["by_process"][c.process_name] += 1
        stats["by_remote_ip"][c.remote_ip] += 1
        if c.status == "ESTABLISHED":
            stats["established"] += 1
        elif c.status == "SYN_SENT":
            stats["syn_sent"] += 1

    return stats


def detect_high_connection_count(
    connections: list[Connection],
    max_per_ip: int = 20,
) -> list[tuple[str, int]]:
    """
    単一IPからの異常に多い接続を検出する。
    (DoS攻撃の可能性)
    """
    from collections import Counter
    counts = Counter(c.remote_ip for c in connections)
    return [
        (ip, count)
        for ip, count in counts.items()
        if count >= max_per_ip
    ]
