"""
ネットワークスキャナー: ARPを使ってローカルネットワーク上のデバイスを検出する
"""
import ipaddress
import logging
import socket
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class Device:
    ip: str
    mac: str
    hostname: str = ""
    first_seen: datetime = field(default_factory=datetime.now)
    last_seen: datetime = field(default_factory=datetime.now)
    is_known: bool = False
    label: str = ""

    def __eq__(self, other):
        return isinstance(other, Device) and self.mac == other.mac

    def __hash__(self):
        return hash(self.mac)


def get_local_network() -> str:
    """ローカルネットワークのCIDRを自動検出する"""
    try:
        # デフォルトゲートウェイ経由でローカルIPを特定
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        # /24 サブネットと仮定
        network = ipaddress.IPv4Network(f"{local_ip}/24", strict=False)
        return str(network)
    except Exception as e:
        logger.warning(f"ネットワーク自動検出失敗: {e}")
        return "192.168.1.0/24"


def resolve_hostname(ip: str) -> str:
    """IPアドレスからホスト名を逆引きする"""
    try:
        return socket.gethostbyaddr(ip)[0]
    except (socket.herror, socket.gaierror):
        return ""


def arp_scan(network: str) -> list[Device]:
    """
    ARPスキャンでネットワーク上のデバイスを検出する。
    scapyが利用可能な場合はscapyを使用し、なければarpコマンドにフォールバックする。
    """
    devices = []
    try:
        devices = _arp_scan_scapy(network)
        if devices:
            return devices
    except Exception as e:
        logger.debug(f"scapy ARPスキャン失敗、フォールバック使用: {e}")

    # フォールバック: arp-scan コマンドまたは nmap
    devices = _arp_scan_system(network)
    return devices


def _arp_scan_scapy(network: str) -> list[Device]:
    """scapyを使ったARPスキャン (root権限が必要)"""
    try:
        from scapy.layers.l2 import ARP, Ether
        from scapy.sendrecv import srp
    except ImportError:
        raise RuntimeError("scapyがインストールされていません")

    devices = []
    arp = ARP(pdst=network)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether / arp

    answered, _ = srp(packet, timeout=3, verbose=False)
    for _, recv in answered:
        ip = recv.psrc
        mac = recv.hwsrc
        hostname = resolve_hostname(ip)
        devices.append(Device(ip=ip, mac=mac, hostname=hostname))

    logger.info(f"scapy ARPスキャン完了: {len(devices)}台検出 ({network})")
    return devices


def _arp_scan_system(network: str) -> list[Device]:
    """arp-scan または nmap コマンドを使ったARPスキャン"""
    devices = []

    # arp-scan を試みる
    try:
        result = subprocess.run(
            ["arp-scan", "--localnet"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                parts = line.split()
                if len(parts) >= 2 and _is_ip(parts[0]) and _is_mac(parts[1]):
                    ip, mac = parts[0], parts[1]
                    hostname = resolve_hostname(ip)
                    devices.append(Device(ip=ip, mac=mac, hostname=hostname))
            if devices:
                logger.info(f"arp-scan完了: {len(devices)}台検出")
                return devices
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # nmap を試みる
    try:
        result = subprocess.run(
            ["nmap", "-sn", "-PR", network],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            devices = _parse_nmap_output(result.stdout)
            logger.info(f"nmap スキャン完了: {len(devices)}台検出")
            return devices
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # 最終フォールバック: pingスイープ + ARPキャッシュ読み取り
    devices = _ping_sweep(network)
    return devices


def _ping_sweep(network: str) -> list[Device]:
    """pingスイープ + ARPキャッシュからデバイスを検出する"""
    devices = []
    try:
        net = ipaddress.IPv4Network(network, strict=False)
        # /24 以上は時間がかかりすぎるため制限
        if net.num_addresses > 256:
            logger.warning("ネットワークが大きすぎます。/24 以下を推奨します。")
            return devices

        # pingスイープ (並行実行)
        import concurrent.futures
        hosts = list(net.hosts())

        def ping_host(ip):
            try:
                subprocess.run(
                    ["ping", "-c", "1", "-W", "1", str(ip)],
                    capture_output=True, timeout=2
                )
            except subprocess.TimeoutExpired:
                pass

        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            executor.map(ping_host, hosts)

        # ARPキャッシュを読み取る
        result = subprocess.run(["arp", "-n"], capture_output=True, text=True)
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 3 and _is_ip(parts[0]) and _is_mac(parts[2]):
                ip, mac = parts[0], parts[2]
                if ipaddress.IPv4Address(ip) in net:
                    hostname = resolve_hostname(ip)
                    devices.append(Device(ip=ip, mac=mac, hostname=hostname))

        logger.info(f"pingスイープ完了: {len(devices)}台検出")
    except Exception as e:
        logger.error(f"pingスイープ失敗: {e}")

    return devices


def _parse_nmap_output(output: str) -> list[Device]:
    """nmap出力からデバイス情報を解析する"""
    devices = []
    current_ip = None
    current_hostname = ""

    for line in output.splitlines():
        if "Nmap scan report for" in line:
            parts = line.split()
            # "Nmap scan report for hostname (IP)" or "Nmap scan report for IP"
            if "(" in line:
                current_hostname = parts[4]
                current_ip = parts[5].strip("()")
            else:
                current_ip = parts[-1]
                current_hostname = resolve_hostname(current_ip) if current_ip else ""
        elif "MAC Address:" in line and current_ip:
            parts = line.split()
            if len(parts) >= 3:
                mac = parts[2]
                devices.append(Device(ip=current_ip, mac=mac, hostname=current_hostname))
                current_ip = None

    return devices


def _is_ip(s: str) -> bool:
    try:
        ipaddress.IPv4Address(s)
        return True
    except ValueError:
        return False


def _is_mac(s: str) -> bool:
    import re
    return bool(re.match(r"^([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}$", s))
