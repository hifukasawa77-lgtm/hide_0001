# ホームネットワークセキュリティモニター

わが家のネットワークに悪意ある攻撃が無いかを調べるPython製CLIツールです。

## 機能

| 機能 | 説明 |
|------|------|
| デバイス検出 | ARPスキャンでネットワーク上の全デバイスを検出 |
| 接続監視 | 外部IPへのアクティブな接続を一覧表示 |
| IP評判チェック | 接続先IPを脅威データベースで検査 |
| ポート監視 | このホストで開いているポートを確認 |
| 新規デバイス検知 | 知らないデバイスがネットワークに接続したらアラート |
| 継続監視モード | 定期的にスキャン・監視してリアルタイムにアラート |

## セットアップ

### 依存ライブラリのインストール

```bash
pip install -r requirements.txt
```

### 設定ファイルの作成 (オプション)

```bash
cp config.example.yaml config.yaml
# config.yaml を編集して設定をカスタマイズ
```

### AbuseIPDB APIキーの設定 (オプション・推奨)

[AbuseIPDB](https://www.abuseipdb.com/) で無料アカウントを作成し、APIキーを取得してください。

```bash
# 環境変数で設定
export ABUSEIPDB_API_KEY="your_api_key_here"

# または config.yaml に記載
# abuseipdb_api_key: "your_api_key_here"
```

## 使い方

### デバイススキャン (ネットワーク上のデバイスを検出)

```bash
# root権限推奨 (ARPスキャンのため)
sudo python -m network_monitor scan
```

出力例:
```
╭──────────────────────────────────────╮
│ 検出されたデバイス (5台)              │
├──────────────┬─────────────────┬─────┤
│ IPアドレス   │ MACアドレス     │状態 │
├──────────────┼─────────────────┼─────┤
│ 192.168.1.1  │ aa:bb:cc:dd:.. │既知 │
│ 192.168.1.5  │ 11:22:33:44:.. │不明 │ ← 知らないデバイス!
╰──────────────┴─────────────────┴─────╯
```

### 接続一覧 (外部への接続を確認)

```bash
python -m network_monitor connections
```

### リスニングポートの確認

```bash
python -m network_monitor ports
```

### IPアドレスの評判チェック

```bash
python -m network_monitor check-ip 1.2.3.4
python -m network_monitor check-ip 1.2.3.4 5.6.7.8  # 複数同時チェック
```

### Webダッシュボード (ブラウザで使う)

```bash
# Webサーバーを起動してブラウザで開く
sudo python -m network_monitor web

# カスタムポートで起動
sudo python -m network_monitor web --port 8080

# ブラウザで http://localhost:8765 にアクセス
```

ダッシュボードの機能:
- リアルタイムの接続統計 (WebSocket)
- ARPスキャンによるデバイス検出
- 外部接続の IP評判チェック
- アラートのリアルタイム表示
- IPアドレスの手動チェック

### 継続監視モード (CLI)

```bash
# 定期的にスキャン・監視してアラートを表示
sudo python -m network_monitor monitor

# 設定ファイルを指定
sudo python -m network_monitor --config /path/to/config.yaml monitor
```

## 検出できる脅威

- **新しいデバイスの接続**: 知らないスマホやPCがWi-Fiに接続した場合
- **悪意あるIPへの通信**: マルウェアが攻撃者のサーバーと通信している場合
- **疑わしいポートへの接続**: Telnet(23)、RDP(3389)、Metasploit(4444)など
- **大量接続**: 単一IPから異常に多くの接続 (DoS攻撃の可能性)
- **プロキシ/VPN経由の通信**: 不審なプロキシサーバーへの接続

## 必要な権限

| コマンド | 権限 |
|----------|------|
| `scan` | root推奨 (ARPスキャンに必要) |
| `connections` | 通常ユーザーでも動作 |
| `ports` | 通常ユーザーでも動作 |
| `monitor` | root推奨 |
| `check-ip` | 通常ユーザーでも動作 |

## アーキテクチャ

```
network_monitor/
├── __main__.py      # CLIエントリポイント・各コマンドの実装
├── scanner.py       # ARPスキャンによるデバイス検出
├── monitor.py       # psutilによる接続・ポート監視
├── threat_intel.py  # AbuseIPDB / ip-api.com による脅威情報
└── detector.py      # ポートスキャン・異常検出ロジック
```

## ライセンス

MIT
