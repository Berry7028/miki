#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$PROJECT_ROOT/desktop"
VENV_DIR="$PROJECT_ROOT/venv"
SETUP_FLAG="$HOME/Library/Application Support/miki-desktop/.setup_completed"
RENDERER_ARTIFACT="$DESKTOP_DIR/renderer/dist"
BACKEND_ARTIFACT="$DESKTOP_DIR/backend/controller"
EXECUTOR_ARTIFACT="$DESKTOP_DIR/backend/executor"
DIST_ARTIFACT="$DESKTOP_DIR/dist"

# カラー出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# アイコン定義
ICON_SAFE="✅"
ICON_WARN="⚠️"
ICON_DANGER="🧨"
ICON_SLOW="⏳"
ICON_INFO="ℹ️"
ICON_SAFE_FALLBACK="[OK]"
ICON_WARN_FALLBACK="[!]"
ICON_DANGER_FALLBACK="[X]"
ICON_SLOW_FALLBACK="[...]"
ICON_INFO_FALLBACK="[i]"
DIVIDER="────────────────────────────────────────"
ERROR_GENERAL=1

# 絵文字が使えない環境向けの簡易フォールバック
if [ -n "$MIKI_DEV_NO_EMOJI" ]; then
  ICON_SAFE="$ICON_SAFE_FALLBACK"
  ICON_WARN="$ICON_WARN_FALLBACK"
  ICON_DANGER="$ICON_DANGER_FALLBACK"
  ICON_SLOW="$ICON_SLOW_FALLBACK"
  ICON_INFO="$ICON_INFO_FALLBACK"
fi

# メニュー定義: key|label|handler|kind
MENU_ITEMS=(
  "start|🚀 アプリを起動（開発モード）|start_app|safe"
  "start-debug|🛠️ アプリをデバッグモードで起動|start_app_debug|safe"
  "dev-ui|🎨 UIのみホットリロード開発モード|start_dev_ui|safe"
  "hot-reload|♻️ 変更監視で再ビルド＆再起動|start_hot_reload|slow"
  "start-fresh|🧨 セットアップをリセットして起動|start_fresh|danger"
  "build-all|⏳ 全コンポーネントを一括ビルド|build_all|slow"
  "build-renderer|⏳ フロントエンド（レンダラー）をビルド|build_renderer|slow"
  "build-backend|⏳ バックエンドをビルド|build_backend|slow"
  "build-executor|⏳ Pythonエグゼキュータをビルド|build_executor|slow"
  "dist|⏳ 配布用パッケージをビルド|build_dist|slow"
  "test|🧪 テストを実行|run_tests|safe"
  "install|📦 依存関係をインストール|install_deps|safe"
  "setup-python|🐍 Python仮想環境をセットアップ|setup_python|safe"
  "doctor|🔍 状態チェックと次の推奨操作|doctor|info"
  "clean|🧨 ビルド成果物を削除|clean_build|danger"
  "reset-setup|🧨 セットアップフラグをリセット|reset_setup|danger"
  "logs|📂 アプリのログディレクトリを開く|open_logs|info"
)

function command_exists() {
  command -v "$1" >/dev/null 2>&1
}

function color_for_kind() {
  case "$1" in
    danger) echo "$RED" ;;
    slow) echo "$YELLOW" ;;
    info) echo "$BLUE" ;;
    *) echo "$GREEN" ;;
  esac
}

function icon_for_kind() {
  case "$1" in
    danger) echo "$ICON_DANGER" ;;
    slow) echo "$ICON_SLOW" ;;
    info) echo "$ICON_INFO" ;;
    *) echo "$ICON_SAFE" ;;
  esac
}

function is_number() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}

function prompt_yes_no() {
  local prompt="$1"
  local default="${2:-n}"
  local suffix="[y/N]"
  if [ "$default" = "y" ]; then
    suffix="[Y/n]"
  fi
  read -p "${prompt} ${suffix}: " -r answer
  answer=${answer:-$default}
  case "$answer" in
    y|Y) return 0 ;;
    *) return 1 ;;
  esac
}

function detect_state() {
  BUN_STATUS="missing"
  BUN_VERSION=""
  if command_exists bun; then
    BUN_STATUS="ready"
    BUN_VERSION="$(bun --version 2>/dev/null || true)"
    if [ -z "$BUN_VERSION" ]; then
      BUN_VERSION="version unknown"
    fi
  fi

  NODE_DEPS_STATUS="missing"
  if [ -d "$DESKTOP_DIR/node_modules" ]; then
    NODE_DEPS_STATUS="ready"
  fi

  PYTHON_BIN="$(command -v python3 || true)"
  PYTHON_STATUS="missing"
  if [ -n "$PYTHON_BIN" ]; then
    PYTHON_STATUS="ready"
  fi

  VENV_STATUS="missing"
  if [ -d "$VENV_DIR" ]; then
    if [ -x "$VENV_DIR/bin/python" ]; then
      if "$VENV_DIR/bin/python" -V >/dev/null 2>&1; then
        VENV_STATUS="ready"
      else
        VENV_STATUS="broken"
      fi
    else
      VENV_STATUS="broken"
    fi
  fi

  SETUP_STATUS="pending"
  if [ -f "$SETUP_FLAG" ]; then
    SETUP_STATUS="done"
  fi

  RENDERER_BUILT="no"
  if [ -e "$RENDERER_ARTIFACT" ]; then
    RENDERER_BUILT="yes"
  fi

  BACKEND_BUILT="no"
  if [ -e "$BACKEND_ARTIFACT" ]; then
    BACKEND_BUILT="yes"
  fi

  EXECUTOR_BUILT="no"
  if [ -e "$EXECUTOR_ARTIFACT" ]; then
    EXECUTOR_BUILT="yes"
  fi

  DIST_BUILT="no"
  if [ -e "$DIST_ARTIFACT" ]; then
    DIST_BUILT="yes"
  fi
}

function status_line() {
  local label="$1"
  local status="$2"
  local detail="$3"
  local color="$YELLOW"
  local icon="$ICON_WARN"
  local text="$status"

  case "$status" in
    ready|done|yes)
      color="$GREEN"
      icon="$ICON_SAFE"
      text="ready"
      ;;
    missing|pending|no)
      color="$YELLOW"
      icon="$ICON_WARN"
      text="missing"
      ;;
    broken)
      color="$RED"
      icon="$ICON_DANGER"
      text="broken"
      ;;
  esac

  echo -e "  ${color}${icon}${NC} ${label}: ${text}${detail:+ (${detail})}"
}

function print_status_panel() {
  detect_state
  local bun_detail="$BUN_VERSION"
  if [ "$BUN_STATUS" != "ready" ]; then
    bun_detail="not installed - see https://bun.sh"
  fi
  echo -e "${BLUE}${DIVIDER}${NC}"
  echo -e "${BLUE}環境状態${NC}"
  status_line "Bun" "$BUN_STATUS" "$bun_detail"
  status_line "Node依存" "$NODE_DEPS_STATUS" "$DESKTOP_DIR/node_modules"
  status_line "Python" "$PYTHON_STATUS" "${PYTHON_BIN:-python3 が見つかりません}"
  status_line "Python venv" "$VENV_STATUS" "$VENV_DIR"
  status_line "セットアップフラグ" "$SETUP_STATUS" "$SETUP_FLAG"
  status_line "Rendererビルド" "$RENDERER_BUILT" "$RENDERER_ARTIFACT"
  status_line "Backendビルド" "$BACKEND_BUILT" "$BACKEND_ARTIFACT"
  status_line "Executorビルド" "$EXECUTOR_BUILT" "$EXECUTOR_ARTIFACT"
  status_line "配布物" "$DIST_BUILT" "$DIST_ARTIFACT"
  echo -e "${BLUE}${DIVIDER}${NC}"
}

function preflight_node() {
  detect_state
  local warnings=""
  if [ "$BUN_STATUS" != "ready" ]; then
    echo -e "${RED}bun が見つかりません。https://bun.sh からインストールして再実行してください。${NC}"
    return 1
  fi
  if [ "$NODE_DEPS_STATUS" != "ready" ]; then
    warnings+="- Node 依存関係が未インストールです。./dev.sh install を実行してください。\n"
  fi

  if [ -n "$warnings" ]; then
    echo -e "${YELLOW}環境チェックに警告があります:${NC}"
    echo -e "$warnings"
    if ! prompt_yes_no "警告を無視して続行しますか？" "n"; then
      echo -e "${RED}操作をキャンセルしました${NC}"
      return 1
    fi
  fi

  return 0
}

function preflight_python() {
  detect_state
  if [ "$PYTHON_STATUS" != "ready" ]; then
    echo -e "${RED}python3 が見つかりません。インストール後に再実行してください。${NC}"
    return 1
  fi

  if [ "$VENV_STATUS" = "ready" ]; then
    return 0
  fi

  if [ "$VENV_STATUS" = "broken" ]; then
    echo -e "${YELLOW}仮想環境が壊れている可能性があります。再生成を提案します。${NC}"
  else
    echo -e "${YELLOW}仮想環境が未作成です。${NC}"
  fi

  if prompt_yes_no "今すぐ Python 仮想環境をセットアップしますか？" "y"; then
    setup_python
    detect_state
    if [ "$VENV_STATUS" = "ready" ]; then
      return 0
    else
      return 1
    fi
  else
    echo -e "${RED}Python 仮想環境が必要な処理です。セットアップ後に再試行してください。${NC}"
    return 1
  fi
}

function print_menu() {
  clear
  echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     miki dev CLI (dev.sh)                  ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
  print_status_panel
  echo -e "${BLUE}操作メニュー${NC}"

  local index=1
  for entry in "${MENU_ITEMS[@]}"; do
    IFS='|' read -r key label _ kind <<<"$entry"
    local color
    color=$(color_for_kind "$kind")
    local icon
    icon=$(icon_for_kind "$kind")
    echo -e "  ${color}${index}. ${icon} ${label}${NC}"
    index=$((index + 1))
  done

  echo -e "  ${RED}0. ✖ 終了${NC}"
  echo ""
  echo -e "${YELLOW}番号を選択してください:${NC} "
}

function print_help() {
  echo -e "${BLUE}miki dev CLI (dev.sh)${NC}"
  echo ""
  echo "使い方: ./dev.sh [コマンド] [オプション]"
  echo ""
  echo "主なコマンド:"
  echo "  ${GREEN}start${NC}              - アプリを起動（開発モード）"
  echo "  ${GREEN}start --debug${NC}      - アプリをデバッグモードで起動"
  echo "  ${GREEN}dev-ui${NC}             - UIのみホットリロード開発モード"
  echo "  ${GREEN}hot-reload${NC}         - 変更監視で再ビルド＆再起動"
  echo "  ${GREEN}start-fresh${NC}        - セットアップフラグをリセットして起動"
  echo "  ${GREEN}build-all${NC}          - 全コンポーネントを一括ビルド"
  echo "  ${GREEN}build-renderer${NC}     - フロントエンド（レンダラー）をビルド"
  echo "  ${GREEN}build-backend${NC}      - バックエンドをビルド"
  echo "  ${GREEN}build-executor${NC}     - Pythonエグゼキュータをビルド"
  echo "  ${GREEN}dist${NC}               - 配布用パッケージをビルド"
  echo "  ${GREEN}test${NC}               - テストを実行"
  echo "  ${GREEN}install${NC}            - Node依存関係をインストール"
  echo "  ${GREEN}setup-python${NC}       - Python仮想環境をセットアップ/再生成"
  echo "  ${GREEN}doctor${NC}             - 状態チェックと次の推奨操作を表示"
  echo "  ${GREEN}clean${NC}              - ビルド成果物を削除"
  echo "  ${GREEN}reset-setup${NC}        - セットアップフラグをリセット"
  echo "  ${GREEN}logs${NC}               - アプリのログディレクトリを開く"
  echo "  ${GREEN}help${NC}               - このヘルプを表示"
  echo "  ${GREEN}menu${NC}               - 対話型メニューを表示"
  echo ""
  echo "ヒント: dev.sh を引数なしで実行すると対話型メニューが開き、"
  echo "状態表示と安全度の色分け付きで操作を選択できます。"
}

function start_app() {
  if ! preflight_node; then
    return 1
  fi
  echo -e "${BLUE}アプリを起動します...${NC}"
  cd "$DESKTOP_DIR"

  if [ "$1" = "--debug" ]; then
    echo -e "${YELLOW}[DEBUG MODE]${NC}"
    bun run dev -- --debug
  else
    bun run dev
  fi
}

function start_app_debug() {
  start_app "--debug"
}

function start_fresh() {
  echo -e "${YELLOW}セットアップフラグをリセットします...${NC}"
  if ! prompt_yes_no "リセット後に起動を続行しますか？" "y"; then
    echo -e "${RED}操作をキャンセルしました${NC}"
    return 1
  fi
  reset_setup
  start_app "$1"
}

function build_executor_if_ready() {
  detect_state
  if [ "$PYTHON_STATUS" != "ready" ] || [ "$VENV_STATUS" != "ready" ]; then
    echo -e "${YELLOW}Python 環境が未準備のため、エグゼキュータのビルドをスキップします。${NC}"
    return 0
  fi
  echo -e "${BLUE}Pythonエグゼキュータをビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run build:executor
  echo -e "${GREEN}✓ エグゼキュータ ビルド完了${NC}"
}

function start_dev_process() {
  cd "$DESKTOP_DIR"
  bun run dev &
  DEV_APP_PID=$!
  cd "$PROJECT_ROOT"
}

function stop_dev_process() {
  if [ -n "${DEV_APP_PID:-}" ]; then
    kill "$DEV_APP_PID" >/dev/null 2>&1 || true
    if command_exists pkill; then
      pkill -TERM -P "$DEV_APP_PID" >/dev/null 2>&1 || true
    fi
    wait "$DEV_APP_PID" >/dev/null 2>&1 || true
    DEV_APP_PID=""
  fi
}

function start_dev_ui() {
  if ! preflight_node; then
    return 1
  fi

  echo -e "${BLUE}UIホットリロード開発モードを開始します...${NC}"
  echo -e "${YELLOW}ヒント: アプリ内で Cmd+R でリロードしてください${NC}"
  cd "$DESKTOP_DIR"
  bun run dev:ui
}

function start_hot_reload() {
  if ! preflight_node; then
    return 1
  fi

  if ! command_exists fswatch; then
    echo -e "${RED}fswatch が見つかりません。${NC}"
    echo -e "${YELLOW}インストール例: brew install fswatch${NC}"
    return 1
  fi

  echo -e "${BLUE}初回ビルドを実行します...${NC}"
  build_renderer
  build_backend
  build_executor_if_ready

  echo -e "${BLUE}アプリを起動します...${NC}"
  start_dev_process

  function cleanup_hot_reload() {
    echo -e "${BLUE}ホットリロードを終了します...${NC}"
    stop_dev_process
  }
  trap cleanup_hot_reload EXIT INT TERM

  echo -e "${BLUE}変更監視を開始しました。Ctrl+C で終了します。${NC}"

  local watch_paths=(
    "$PROJECT_ROOT/src"
    "$DESKTOP_DIR/renderer"
    "$DESKTOP_DIR/backend-src"
    "$DESKTOP_DIR/main.js"
    "$DESKTOP_DIR/preload.js"
  )

  local watch_cmd=(fswatch -o)
  watch_cmd+=(-e "node_modules")
  watch_cmd+=(-e "/dist")
  watch_cmd+=(-e "/backend/")
  watch_cmd+=(-e "/renderer/dist")
  watch_cmd+=(-e "/venv")
  watch_cmd+=(-e "/.git")
  watch_cmd+=("${watch_paths[@]}")

  while read -r _; do
    echo -e "${YELLOW}変更を検知しました。再ビルドして再起動します...${NC}"
    stop_dev_process
    build_renderer
    build_backend
    build_executor_if_ready
    start_dev_process
  done < <("${watch_cmd[@]}")
}

function build_backend() {
  if ! preflight_node; then
    return 1
  fi
  echo -e "${BLUE}バックエンドをビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run build:backend
  echo -e "${GREEN}✓ バックエンド ビルド完了${NC}"
}

function build_renderer() {
  if ! preflight_node; then
    return 1
  fi
  echo -e "${BLUE}フロントエンド（レンダラー）をビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run build:renderer
  echo -e "${GREEN}✓ フロントエンド ビルド完了${NC}"
}

function build_executor() {
  if ! preflight_node; then
    return 1
  fi
  if ! preflight_python; then
    return 1
  fi
  echo -e "${BLUE}Pythonエグゼキュータをビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run build:executor
  echo -e "${GREEN}✓ エグゼキュータ ビルド完了${NC}"
}

function build_all() {
  if ! preflight_node; then
    return 1
  fi
  if ! preflight_python; then
    return 1
  fi
  echo -e "${BLUE}全てのコンポーネントを一括ビルドします...${NC}"
  build_renderer
  build_backend
  build_executor
  echo -e "${GREEN}✓ 全コンポーネントのビルドが完了しました${NC}"
}

function build_dist() {
  if ! preflight_node; then
    return 1
  fi
  if ! preflight_python; then
    return 1
  fi
  echo -e "${BLUE}配布用パッケージをビルドします...${NC}"
  cd "$DESKTOP_DIR"
  bun run dist
  echo -e "${GREEN}✓ 配布パッケージ ビルド完了${NC}"
  echo -e "${BLUE}出力先: $DESKTOP_DIR/dist/${NC}"
}

function clean_build() {
  if ! prompt_yes_no "ビルド成果物を削除します。続行しますか？" "n"; then
    echo -e "${RED}操作をキャンセルしました${NC}"
    return 0
  fi

  echo -e "${YELLOW}ビルド成果物を削除します...${NC}"

  if [ -d "$DESKTOP_DIR/backend" ]; then
    rm -rf "$DESKTOP_DIR/backend"
    echo -e "${GREEN}✓ backend/ を削除${NC}"
  fi

  if [ -d "$DESKTOP_DIR/dist" ]; then
    rm -rf "$DESKTOP_DIR/dist"
    echo -e "${GREEN}✓ dist/ を削除${NC}"
  fi

  if [ -d "$DESKTOP_DIR/renderer/dist" ]; then
    rm -rf "$DESKTOP_DIR/renderer/dist"
    echo -e "${GREEN}✓ renderer/dist を削除${NC}"
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
  if ! command_exists bun; then
    echo -e "${RED}bun が見つかりません。https://bun.sh を確認してください。${NC}"
    return 1
  fi

  echo -e "${BLUE}依存関係をインストールします...${NC}"
  echo -e "${BLUE}Desktop依存関係をインストール中...${NC}"
  cd "$DESKTOP_DIR"
  bun install
  echo -e "${GREEN}✓ インストール完了${NC}"
}

function setup_python() {
  detect_state
  echo -e "${BLUE}Python仮想環境をセットアップします...${NC}"

  if [ "$VENV_STATUS" = "broken" ]; then
    echo -e "${YELLOW}既存の仮想環境が壊れているため再作成します...${NC}"
    rm -rf "$VENV_DIR"
  fi

  if [ ! -d "$VENV_DIR" ]; then
    echo -e "${BLUE}仮想環境を作成中...${NC}"
    python3 -m venv "$VENV_DIR"
  fi

  echo -e "${BLUE}依存関係をインストール中...${NC}"
  # shellcheck disable=SC1091 # load python3 -m venv generated activate script (external, expected)
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
  if ! preflight_node; then
    return 1
  fi
  echo -e "${BLUE}テストを実行します...${NC}"
  cd "$PROJECT_ROOT"
  npm test
  echo -e "${GREEN}✓ テスト完了${NC}"
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

function doctor() {
  print_status_panel
  echo -e "${BLUE}推奨アクション${NC}"
  local suggestions=""

  if [ "$BUN_STATUS" != "ready" ]; then
    suggestions+="- bun をインストールしてください (https://bun.sh)\n"
  fi
  if [ "$NODE_DEPS_STATUS" != "ready" ]; then
    suggestions+="- ./dev.sh install を実行して Node 依存を揃えてください\n"
  fi
  if [ "$VENV_STATUS" = "missing" ]; then
    suggestions+="- ./dev.sh setup-python で仮想環境を作成してください\n"
  elif [ "$VENV_STATUS" = "broken" ]; then
    suggestions+="- ./dev.sh setup-python で仮想環境を再生成してください\n"
  fi
  if [ "$BACKEND_BUILT" != "yes" ]; then
    suggestions+="- ./dev.sh build-backend でバックエンドをビルドしてください\n"
  fi
  if [ "$EXECUTOR_BUILT" != "yes" ]; then
    suggestions+="- ./dev.sh build-executor で Python エグゼキュータをビルドしてください\n"
  fi
  if [ "$DIST_BUILT" != "yes" ]; then
    suggestions+="- 配布パッケージが必要な場合は ./dev.sh dist を実行してください\n"
  fi

  if [ -z "$suggestions" ]; then
    echo -e "${GREEN}すべて準備完了です。必要に応じて start / build 系コマンドを実行してください。${NC}"
  else
    echo -e "$suggestions"
  fi
}

function interactive_menu() {
  local menu_length=${#MENU_ITEMS[@]}
  # 拡張時に MENU_ITEMS を動的に差し替えた場合のセーフガード
  if [ "$menu_length" -eq 0 ]; then
    echo -e "${RED}メニューが定義されていません。dev.sh を確認してください。${NC}"
    exit "$ERROR_GENERAL"
  fi

  while true; do
    print_menu
    read -r choice

    if [ "$choice" = "0" ]; then
      echo -e "${BLUE}終了します${NC}"
      exit 0
    fi

    if is_number "$choice" && [ "$choice" -ge 1 ] && [ "$choice" -le "$menu_length" ]; then
      local entry="${MENU_ITEMS[$((choice - 1))]}"
      IFS='|' read -r key label func kind <<<"$entry"
      echo -e "${BLUE}${DIVIDER}${NC}"
      echo -e "${BLUE}${label}${NC}"
      echo -e "${BLUE}${DIVIDER}${NC}"
      if ! "$func"; then
        echo -e "${RED}処理に失敗しました。doctor コマンドで状態を確認してください。${NC}"
      fi
      echo ""
      read -p "Enterキーを押してメニューに戻る..." -r
    else
      echo -e "${RED}無効な選択です。番号を入力してください。${NC}"
      sleep 1
    fi
  done
}

# メイン処理
if [ $# -eq 0 ]; then
  interactive_menu
else
  case "${1}" in
    start)
    start_app "${2}"
      ;;
    dev-ui)
      start_dev_ui
      ;;
    hot-reload|watch)
      start_hot_reload
      ;;
    start-debug)
      start_app_debug
      ;;
    start-fresh)
      start_fresh "${2}"
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
    doctor|status)
      doctor
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
    menu)
      interactive_menu
      ;;
    *)
      echo -e "${RED}不明なコマンド: $1${NC}"
      echo ""
      print_help
      exit "$ERROR_GENERAL"
      ;;
  esac
fi
