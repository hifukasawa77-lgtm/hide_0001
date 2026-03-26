"""
ホームネットワークセキュリティモニター - メインエントリポイント
使い方: python -m network_monitor [コマンド] [オプション]
"""
import argparse
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# rich がない場合のフォールバック
try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich import box
    from rich.live import Live
    from rich.layout import Layout
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

from . import __version__
from .scanner import arp_scan, get_local_network, Device
from .monitor import (
    get_active_connections,
    get_external_connections,
    get_listening_ports,
    get_connection_stats,
)
from .threat_intel import check_ip_reputation, check_multiple_ips
from .detector import (
    Alert,
    AlertLevel,
    NewDeviceDetector,
    ConnectionAnomalyDetector,
    PortScanDetector,
)

console = Console() if HAS_RICH else None

LEVEL_COLORS = {
    AlertLevel.INFO: "cyan",
    AlertLevel.WARNING: "yellow",
    AlertLevel.CRITICAL: "bold red",
}


# --------------------------------------------------------------------------- #
# ヘルパー関数                                                                  #
# --------------------------------------------------------------------------- #

def _print(msg: str, style: str = "") -> None:
    if console:
        console.print(msg, style=style)
    else:
        print(msg)


def _load_config(config_path: str) -> dict:
    """設定ファイルを読み込む"""
    config = {
        "network": "",
        "scan_interval": 60,
        "monitor_interval": 5,
        "abuseipdb_api_key": "",
        "thresholds": {
            "port_scan_ports": 10,
            "port_scan_window": 10,
            "max_connections_per_ip": 20,
        },
        "log_file": "network_monitor.log",
        "log_level": "INFO",
        "known_devices": [],
    }

    if config_path and Path(config_path).exists():
        try:
            import yaml
            with open(config_path) as f:
                user_config = yaml.safe_load(f)
            if user_config:
                config.update(user_config)
        except Exception as e:
            _print(f"[!] 設定ファイル読み込みエラー: {e}", style="yellow")

    # 環境変数からAPIキーを上書き
    if os.environ.get("ABUSEIPDB_API_KEY"):
        config["abuseipdb_api_key"] = os.environ["ABUSEIPDB_API_KEY"]

    return config


def _setup_logging(log_file: str, log_level: str) -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stderr),
        ],
    )


def _print_alert(alert: Alert) -> None:
    color = LEVEL_COLORS.get(alert.level, "white")
    ts = alert.timestamp.strftime("%H:%M:%S")
    if console:
        level_badge = f"[{color}][{alert.level.value.upper()}][/{color}]"
        src = f" [[bold]{alert.source_ip}[/bold]]" if alert.source_ip else ""
        console.print(f"{ts} {level_badge}{src} [bold]{alert.title}[/bold]")
        console.print(f"    {alert.description}", style="dim")
    else:
        print(f"[{ts}] [{alert.level.value.upper()}] {alert.title}: {alert.description}")


# --------------------------------------------------------------------------- #
# サブコマンド: scan                                                            #
# --------------------------------------------------------------------------- #

def cmd_scan(args, config: dict) -> None:
    """ネットワーク上のデバイスをスキャンして表示する"""
    network = config.get("network") or get_local_network()
    _print(f"\n[bold]ネットワークスキャン中...[/bold] ({network})" if console else f"スキャン中: {network}")

    devices = arp_scan(network)

    if not devices:
        _print("[yellow]デバイスが見つかりませんでした。root権限が必要な場合があります。[/yellow]")
        return

    if console:
        table = Table(
            title=f"検出されたデバイス ({len(devices)}台)",
            box=box.ROUNDED,
            show_header=True,
        )
        table.add_column("IPアドレス", style="cyan")
        table.add_column("MACアドレス")
        table.add_column("ホスト名")
        table.add_column("状態")

        known_macs = {d.get("mac", "").lower() for d in config.get("known_devices", [])}
        for d in sorted(devices, key=lambda x: x.ip):
            status = "[green]既知[/green]" if d.mac.lower() in known_macs else "[yellow]不明[/yellow]"
            table.add_row(d.ip, d.mac, d.hostname or "-", status)

        console.print(table)
    else:
        print(f"\n{'IP':18} {'MAC':18} {'ホスト名':30} 状態")
        print("-" * 75)
        known_macs = {d.get("mac", "").lower() for d in config.get("known_devices", [])}
        for d in sorted(devices, key=lambda x: x.ip):
            status = "既知" if d.mac.lower() in known_macs else "不明"
            print(f"{d.ip:18} {d.mac:18} {d.hostname or '-':30} {status}")


# --------------------------------------------------------------------------- #
# サブコマンド: connections                                                     #
# --------------------------------------------------------------------------- #

def cmd_connections(args, config: dict) -> None:
    """現在のネットワーク接続を表示する"""
    _print("\n[bold]アクティブな接続を取得中...[/bold]" if console else "接続一覧取得中...")
    connections = get_active_connections()
    ext_connections = get_external_connections(connections)
    api_key = config.get("abuseipdb_api_key", "")

    # IPの評判チェック
    external_ips = list({c.remote_ip for c in ext_connections})
    ip_reputations: dict[str, dict] = {}
    if external_ips:
        _print(f"[dim]{len(external_ips)}件のIPを評判チェック中...[/dim]" if console else "IP評判チェック中...")
        ip_reputations = check_multiple_ips(external_ips, api_key)

    if console:
        table = Table(
            title=f"外部への接続 ({len(ext_connections)}件)",
            box=box.ROUNDED,
        )
        table.add_column("プロセス", style="cyan")
        table.add_column("ローカル")
        table.add_column("リモートIP")
        table.add_column("ポート")
        table.add_column("国")
        table.add_column("評判")
        table.add_column("状態")

        for c in ext_connections:
            rep = ip_reputations.get(c.remote_ip, {})
            if rep.get("is_malicious"):
                rep_text = "[bold red]危険[/bold red]"
            elif rep.get("is_suspicious"):
                rep_text = "[yellow]要注意[/yellow]"
            else:
                rep_text = "[green]正常[/green]"

            status_color = "green" if c.status == "ESTABLISHED" else "yellow"
            table.add_row(
                c.process_name or "-",
                f"{c.local_ip}:{c.local_port}",
                c.remote_ip,
                str(c.remote_port),
                rep.get("country", "-"),
                rep_text,
                f"[{status_color}]{c.status}[/{status_color}]",
            )

        console.print(table)

        # 疑わしい接続のサマリー
        suspicious = [c for c in ext_connections if c.is_suspicious]
        if suspicious:
            console.print(f"\n[bold yellow][!] 疑わしい接続: {len(suspicious)}件[/bold yellow]")
            for c in suspicious:
                console.print(f"  - {c.process_name} -> {c.remote_ip}:{c.remote_port} ({c.alert_reason})")
    else:
        print(f"\n外部への接続: {len(ext_connections)}件")
        for c in ext_connections:
            rep = ip_reputations.get(c.remote_ip, {})
            flag = " [危険!]" if rep.get("is_malicious") else ""
            print(f"  {c.process_name or '?':20} {c.remote_ip}:{c.remote_port} [{c.status}]{flag}")


# --------------------------------------------------------------------------- #
# サブコマンド: ports                                                           #
# --------------------------------------------------------------------------- #

def cmd_ports(args, config: dict) -> None:
    """このホストでリスニング中のポートを表示する"""
    _print("\n[bold]リスニングポートを確認中...[/bold]" if console else "ポート確認中...")
    ports = get_listening_ports()

    if not ports:
        _print("[green]リスニングポートが見つかりませんでした。[/green]")
        return

    if console:
        table = Table(title="リスニングポート", box=box.ROUNDED)
        table.add_column("ポート", style="cyan")
        table.add_column("IPアドレス")
        table.add_column("プロセス")
        table.add_column("PID")
        table.add_column("評価")

        for p in ports:
            if p["is_suspicious"]:
                status = f"[bold red]要注意: {p['reason']}[/bold red]"
            elif p["port"] < 1024:
                status = "[yellow]システムポート[/yellow]"
            else:
                status = "[green]正常[/green]"

            table.add_row(
                str(p["port"]),
                p["ip"],
                p["process"] or "-",
                str(p["pid"] or "-"),
                status,
            )
        console.print(table)
    else:
        print(f"\n{'ポート':8} {'IP':18} {'プロセス':25} 評価")
        print("-" * 65)
        for p in ports:
            status = f"[要注意] {p['reason']}" if p["is_suspicious"] else "正常"
            print(f"{p['port']:<8} {p['ip']:18} {(p['process'] or '-'):25} {status}")


# --------------------------------------------------------------------------- #
# サブコマンド: monitor (継続監視モード)                                         #
# --------------------------------------------------------------------------- #

def cmd_monitor(args, config: dict) -> None:
    """継続的にネットワークを監視してアラートを表示する"""
    network = config.get("network") or get_local_network()
    scan_interval = config.get("scan_interval", 60)
    monitor_interval = config.get("monitor_interval", 5)
    api_key = config.get("abuseipdb_api_key", "")
    thresholds = config.get("thresholds", {})

    known_macs = {
        d.get("mac", "").lower()
        for d in config.get("known_devices", [])
    }

    # 検出器の初期化
    device_detector = NewDeviceDetector(known_macs=known_macs)
    conn_detector = ConnectionAnomalyDetector(
        max_connections_per_ip=thresholds.get("max_connections_per_ip", 20)
    )

    alerts: list[Alert] = []

    _print(Panel(
        f"[bold green]ホームネットワークセキュリティモニター v{__version__}[/bold green]\n"
        f"ネットワーク: {network}\n"
        f"スキャン間隔: {scan_interval}秒 / 接続チェック間隔: {monitor_interval}秒\n"
        f"[dim]Ctrl+C で終了[/dim]",
        title="監視開始",
    ) if console else f"監視開始: {network} (Ctrl+C で終了)")

    last_scan_time = 0.0

    try:
        while True:
            now = time.time()
            new_alerts: list[Alert] = []

            # デバイススキャン (scan_interval ごと)
            if now - last_scan_time >= scan_interval:
                _print(f"\n[dim]{datetime.now().strftime('%H:%M:%S')} デバイススキャン中...[/dim]" if console
                       else f"\n{datetime.now().strftime('%H:%M:%S')} デバイススキャン中...")
                try:
                    devices = arp_scan(network)
                    for d in devices:
                        alert = device_detector.check_device(d.mac, d.ip, d.hostname)
                        if alert:
                            new_alerts.append(alert)
                    _print(f"[dim]  → {len(devices)}台のデバイスを確認[/dim]" if console
                           else f"  → {len(devices)}台確認")
                except Exception as e:
                    logging.warning(f"スキャンエラー: {e}")
                last_scan_time = now

            # 接続モニタリング
            try:
                connections = get_active_connections()
                conn_alerts = conn_detector.analyze_connections(connections)
                new_alerts.extend(conn_alerts)

                # 外部IPの評判チェック
                ext_ips = list({c.remote_ip for c in get_external_connections(connections)})
                if ext_ips and api_key:
                    rep_results = check_multiple_ips(ext_ips[:10], api_key)  # 1回最大10件
                    for ip, rep in rep_results.items():
                        alert = conn_detector.check_malicious_ip(ip, rep)
                        if alert:
                            new_alerts.append(alert)

            except Exception as e:
                logging.warning(f"接続監視エラー: {e}")

            # アラートを表示
            for alert in new_alerts:
                _print_alert(alert)
                alerts.append(alert)

            if not new_alerts:
                ts = datetime.now().strftime("%H:%M:%S")
                _print(f"[dim]{ts} 異常なし[/dim]" if console else f"{ts} 異常なし", style="")

            time.sleep(monitor_interval)

    except KeyboardInterrupt:
        _print("\n[bold]監視を終了しました。[/bold]" if console else "\n監視終了")
        if alerts:
            _print(f"\n[bold]アラートサマリー: 合計 {len(alerts)} 件[/bold]" if console
                  else f"\nアラートサマリー: {len(alerts)}件")
            critical = [a for a in alerts if a.level == AlertLevel.CRITICAL]
            warning = [a for a in alerts if a.level == AlertLevel.WARNING]
            _print(f"  危険: {len(critical)}件  要注意: {len(warning)}件")


# --------------------------------------------------------------------------- #
# サブコマンド: web (ブラウザUI)                                                 #
# --------------------------------------------------------------------------- #

def cmd_web(args, config: dict) -> None:
    """ブラウザで操作できるWebダッシュボードを起動する"""
    try:
        import uvicorn
    except ImportError:
        _print("[red]uvicornがインストールされていません。pip install uvicorn fastapi を実行してください。[/red]")
        sys.exit(1)

    from .web.app import create_app

    host = args.host
    port = args.port
    app = create_app(config)

    url = f"http://{host if host != '0.0.0.0' else 'localhost'}:{port}"
    _print(
        f"\n[bold green]Webダッシュボードを起動しています...[/bold green]\n"
        f"ブラウザで [bold cyan]{url}[/bold cyan] を開いてください\n"
        f"[dim]Ctrl+C で終了[/dim]"
        if console else
        f"\nブラウザで {url} を開いてください (Ctrl+C で終了)"
    )

    uvicorn.run(app, host=host, port=port, log_level="warning")


# --------------------------------------------------------------------------- #
# サブコマンド: check-ip                                                        #
# --------------------------------------------------------------------------- #

def cmd_check_ip(args, config: dict) -> None:
    """指定したIPアドレスの評判をチェックする"""
    api_key = config.get("abuseipdb_api_key", "")
    for ip in args.ip:
        _print(f"\n[bold]IPチェック: {ip}[/bold]" if console else f"\nIPチェック: {ip}")
        result = check_ip_reputation(ip, api_key)

        if console:
            color = "red" if result.get("is_malicious") else ("yellow" if result.get("is_suspicious") else "green")
            status = "危険" if result.get("is_malicious") else ("要注意" if result.get("is_suspicious") else "正常")
            console.print(f"  評価: [{color}]{status}[/{color}]")
            console.print(f"  国: {result.get('country', '不明')}")
            console.print(f"  情報源: {result.get('source', '-')}")
            console.print(f"  詳細: {result.get('detail', '-')}")
            if result.get("isp"):
                console.print(f"  ISP: {result.get('isp')}")
        else:
            status = "危険" if result.get("is_malicious") else ("要注意" if result.get("is_suspicious") else "正常")
            print(f"  評価: {status}")
            print(f"  国: {result.get('country', '不明')}")
            print(f"  詳細: {result.get('detail', '-')}")


# --------------------------------------------------------------------------- #
# メイン                                                                        #
# --------------------------------------------------------------------------- #

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="network-monitor",
        description="ホームネットワークセキュリティモニター",
    )
    parser.add_argument(
        "--config", "-c",
        default="config.yaml",
        help="設定ファイルのパス (デフォルト: config.yaml)",
    )
    parser.add_argument("--version", "-v", action="version", version=f"%(prog)s {__version__}")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # scan
    scan_parser = subparsers.add_parser("scan", help="ネットワーク上のデバイスをスキャンする")
    scan_parser.set_defaults(func=cmd_scan)

    # connections
    conn_parser = subparsers.add_parser("connections", help="アクティブな外部接続を表示する")
    conn_parser.set_defaults(func=cmd_connections)

    # ports
    ports_parser = subparsers.add_parser("ports", help="リスニング中のポートを表示する")
    ports_parser.set_defaults(func=cmd_ports)

    # monitor
    monitor_parser = subparsers.add_parser("monitor", help="継続的に監視する (Ctrl+C で終了)")
    monitor_parser.set_defaults(func=cmd_monitor)

    # web
    web_parser = subparsers.add_parser("web", help="ブラウザで使えるWebダッシュボードを起動する")
    web_parser.add_argument("--host", default="127.0.0.1", help="ホスト (デフォルト: 127.0.0.1)")
    web_parser.add_argument("--port", type=int, default=8765, help="ポート番号 (デフォルト: 8765)")
    web_parser.set_defaults(func=cmd_web)

    # check-ip
    checkip_parser = subparsers.add_parser("check-ip", help="IPアドレスの評判をチェックする")
    checkip_parser.add_argument("ip", nargs="+", help="チェックするIPアドレス")
    checkip_parser.set_defaults(func=cmd_check_ip)

    args = parser.parse_args()
    config = _load_config(args.config)
    _setup_logging(config.get("log_file", "network_monitor.log"), config.get("log_level", "INFO"))

    args.func(args, config)


if __name__ == "__main__":
    main()
