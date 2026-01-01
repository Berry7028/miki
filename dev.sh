#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$PROJECT_ROOT/desktop"
VENV_DIR="$PROJECT_ROOT/venv"
SETUP_FLAG="$HOME/Library/Application Support/miki-desktop/.setup_completed"

# カラー出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

function print_menu() {
  clear
  echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     miki desktop 開発スクリプト           ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${GREEN}1${NC}) アプリを起動（開発モード）"
  echo -e "  ${GREEN}2${NC}) セットアップをリセットして起動"
  echo -e "  ${GREEN}3${NC}) 全コンポーネントを一括ビルド"
  echo -e "  ${GREEN}4${NC}) フロントエンド（レンダラー）をビルド"
  echo -e "  ${GREEN}5${NC}) バックエンドをビルド"
  echo -e "  ${GREEN}6${NC}) Pythonエグゼキュータをビルド"
  echo -e "  ${GREEN}7${NC}) 配布用パッケージをビルド"
  echo -e "  ${GREEN}8${NC}) ビルド成果物を削除"
  echo -e "  ${GREEN}9${NC}) セットアップフラグをリセット"
  echo -e "  ${GREEN}10${NC}) 依存関係をインストール"
  echo -e "  ${GREEN}11${NC}) Python仮想環境をセットアップ"
  echo -e "  ${GREEN}12${NC}) アプリのログディレクトリを開く"
  echo -e "  ${RED}0${NC}) 終了"
  echo ""
  echo -e "${YELLOW}選択してください [0-12]:${NC} "
}

function print_help() {
  echo -e "${BLUE}miki desktop 開発スクリプト${NC}"
  echo ""
  echo "使い方: ./dev.sh [コマンド]"
  echo ""
  echo "コマンド一覧:"
  echo "  ${GREEN}start${NC}            - アプリを起動（開発モード）"
  echo "  ${GREEN}start-fresh${NC}      - セットアップをリセットしてアプリを起動"
  echo "  ${GREEN}build-all${NC}        - 全コンポーネントを一括ビルド"
  echo "  ${GREEN}build-renderer${NC}   - フロントエンド（レンダラー）をビルド"
  echo "  ${GREEN}build-backend${NC}    - バックエンドをビルド"
  echo "  ${GREEN}build-executor${NC}   - Pythonエグゼキュータをビルド"
  echo "  ${GREEN}dist${NC}             - 配布用パッケージをビルド"
  echo "  ${GREEN}clean${NC}            - ビルド成果物を削除"
  echo "  ${GREEN}reset-setup${NC}      - セットアップフラグをリセット"
  echo "  ${GREEN}install${NC}          - 依存関係をインストール"
  echo "  ${GREEN}setup-python${NC}     - Python仮想環境をセットアップ"
  echo "  ${GREEN}test${NC}             - テストを実行（未実装）"
  echo "  ${GREEN}logs${NC}             - アプリのログディレクトリを開く"
  echo "  ${GREEN}help${NC}             - このヘルプを表示"
  echo ""
  echo "引数なしで実行すると対話型メニューが表示されます。"
  echo ""
}

function start_app() {
  echo -e "${BLUE}アプリを起動します...${NC}"
  cd "$DESKTOP_DIR"
  bun run dev
}

function start_fresh() {
  echo -e "${YELLOW}セットアップフラグをリセットします...${NC}"
  reset_setup
  echo -e "${BLUE}アプリを起動します...${NC}"
  cd "$DESKTOP_DIR"
  bun run dev
}

function build_backend() {
  echo -e "${BLUE}バックエンドをビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run build:backend
  echo -e "${GREEN}✓ バックエンド ビルド完了${NC}"
}

function build_renderer() {
  echo -e "${BLUE}フロントエンド（レンダラー）をビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run build:renderer
  echo -e "${GREEN}✓ フロントエンド ビルド完了${NC}"
}

function build_executor() {
  echo -e "${BLUE}Pythonエグゼキュータをビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run build:executor
  echo -e "${GREEN}✓ エグゼキュータ ビルド完了${NC}"
}

function build_all() {
  echo -e "${BLUE}全てのコンポーネントを一括ビルドします...${NC}"
  build_renderer
  build_backend
  build_executor
  echo -e "${GREEN}✓ 全コンポーネントのビルドが完了しました${NC}"
}

function build_dist() {
  echo -e "${BLUE}配布用パッケージをビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run dist
  echo -e "${GREEN}✓ 配布パッケージ ビルド完了${NC}"
  echo -e "${BLUE}出力先: $DESKTOP_DIR/dist/${NC}"
}

function clean_build() {
  echo -e "${YELLOW}ビルド成果物を削除します...${NC}"

  if [ -d "$DESKTOP_DIR/backend" ]; then
    rm -rf "$DESKTOP_DIR/backend"
    echo -e "${GREEN}✓ backend/ を削除${NC}"
  fi

  if [ -d "$DESKTOP_DIR/dist" ]; then
    rm -rf "$DESKTOP_DIR/dist"
    echo -e "${GREEN}✓ dist/ を削除${NC}"
  fi

  echo -e "${GREEN}✓ クリーン完了${NC}"
}

function reset_setup() {
  if [ -f "$SETUP_FLAG" ]; then
    rm "$SETUP_FLAG"
    echo -e "${GREEN}✓ セットアップフラグを削除しました${NC}"
  else
    echo -e "${YELLOW}セットアップフラグは存在しません${NC}"
  fi
}

function install_deps() {
  echo -e "${BLUE}依存関係をインストールします...${NC}"

  echo -e "${BLUE}Desktop依存関係をインストール中...${NC}"
  cd "$DESKTOP_DIR"
  bun install

  echo -e "${GREEN}✓ インストール完了${NC}"
}

function setup_python() {
  echo -e "${BLUE}Python仮想環境をセットアップします...${NC}"

  if [ ! -d "$VENV_DIR" ]; then
    echo -e "${BLUE}仮想環境を作成中...${NC}"
    python3 -m venv "$VENV_DIR"
  fi

  echo -e "${BLUE}依存関係をインストール中...${NC}"
  source "$VENV_DIR/bin/activate"

  if [ -f "$PROJECT_ROOT/requirements.txt" ]; then
    pip install --upgrade pip
    pip install -r "$PROJECT_ROOT/requirements.txt"
  else
    echo -e "${YELLOW}requirements.txt が見つかりません。基本パッケージをインストールします...${NC}"
    pip install pyautogui pyperclip pillow pyinstaller
  fi

  echo -e "${GREEN}✓ Python環境セットアップ完了${NC}"
}

function run_tests() {
  echo -e "${RED}テストは未実装です${NC}"
}

function open_logs() {
  LOG_DIR="$HOME/Library/Application Support/miki-desktop"
  if [ -d "$LOG_DIR" ]; then
    echo -e "${BLUE}ログディレクトリを開きます: $LOG_DIR${NC}"
    open "$LOG_DIR"
  else
    echo -e "${YELLOW}ログディレクトリが見つかりません: $LOG_DIR${NC}"
  fi
}

function interactive_menu() {
  while true; do
    print_menu
    read -r choice

    case $choice in
      1)
        start_app
        ;;
      2)
        start_fresh
        ;;
      3)
        build_all
        read -p "Enterキーを押して続行..." -r
        ;;
      4)
        build_renderer
        read -p "Enterキーを押して続行..." -r
        ;;
      5)
        build_backend
        read -p "Enterキーを押して続行..." -r
        ;;
      6)
        build_executor
        read -p "Enterキーを押して続行..." -r
        ;;
      7)
        build_dist
        read -p "Enterキーを押して続行..." -r
        ;;
      8)
        clean_build
        read -p "Enterキーを押して続行..." -r
        ;;
      9)
        reset_setup
        read -p "Enterキーを押して続行..." -r
        ;;
      10)
        install_deps
        read -p "Enterキーを押して続行..." -r
        ;;
      11)
        setup_python
        read -p "Enterキーを押して続行..." -r
        ;;
      12)
        open_logs
        read -p "Enterキーを押して続行..." -r
        ;;
      0)
        echo -e "${BLUE}終了します${NC}"
        exit 0
        ;;
      *)
        echo -e "${RED}無効な選択です。0-12の数字を入力してください。${NC}"
        sleep 2
        ;;
    esac
  done
}

# メイン処理
if [ $# -eq 0 ]; then
  # 引数なし - 対話型メニュー
  interactive_menu
else
  # 引数あり - コマンドライン引数で実行
  case "${1}" in
    start)
      start_app
      ;;
    start-fresh)
      start_fresh
      ;;
    build-all)
      build_all
      ;;
    build-renderer)
      build_renderer
      ;;
    build-backend|build)
      build_backend
      ;;
    build-executor)
      build_executor
      ;;
    dist)
      build_dist
      ;;
    clean)
      clean_build
      ;;
    reset-setup)
      reset_setup
      ;;
    install)
      install_deps
      ;;
    setup-python)
      setup_python
      ;;
    test)
      run_tests
      ;;
    logs)
      open_logs
      ;;
    help|--help|-h)
      print_help
      ;;
    *)
      echo -e "${RED}不明なコマンド: $1${NC}"
      echo ""
      print_help
      exit 1
      ;;
  esac
fi
