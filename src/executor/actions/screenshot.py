"""スクリーンショット取得とハイライト描画"""
from typing import Dict, Any, Tuple, Optional
from PIL import Image
import pyautogui
import base64
from io import BytesIO
from constants import DEFAULT_HIGHLIGHT_RADIUS, DEFAULT_SCREENSHOT_QUALITY


def _calculate_image_scale_factors(img: Image.Image) -> Tuple[float, float]:
    """
    画像とスクリーンサイズから倍率を計算
    Retina等でのスクリーンショットと論理座標の差を考慮
    """
    screen_w, screen_h = pyautogui.size()
    img_w, img_h = img.size
    return img_w / screen_w, img_h / screen_h


def draw_point_on_screenshot(img: Image.Image, x: int, y: int,
                            radius: int = DEFAULT_HIGHLIGHT_RADIUS,
                            color: str = "red") -> Image.Image:
    """スクリーンショット上の指定座標にハイライト（赤い点）を描画する"""
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)

    # ディスプレイのスケーリング（Retina等）を考慮
    scale_x, scale_y = _calculate_image_scale_factors(img)

    ix, iy = x * scale_x, y * scale_y

    left_up = (ix - radius, iy - radius)
    right_down = (ix + radius, iy + radius)
    draw.ellipse([left_up, right_down], fill=color, outline="white", width=2)
    return img


def screenshot(highlight_pos: Optional[Dict[str, int]] = None,
               quality: int = DEFAULT_SCREENSHOT_QUALITY) -> Dict[str, Any]:
    """
    画面のスクリーンショットを撮り、Base64文字列で返し、現在のマウス位置も提供する

    Args:
        highlight_pos: ハイライト位置 {"x": int, "y": int}
        quality: JPEG品質（1-100）。デフォルト85で高品質かつ軽量
                 TypeScript側のPERFORMANCE_CONFIG.SCREENSHOT_QUALITYから渡される
    """
    shot = pyautogui.screenshot()

    # ハイライト位置が指定されている場合は描画
    if highlight_pos:
        shot = draw_point_on_screenshot(
            shot, highlight_pos['x'], highlight_pos['y'])

    # JPEG形式で圧縮して転送データ量を削減
    # Note: スクリーンショットは通常透明度を持たないため、RGBへの変換は安全
    buffered = BytesIO()
    if shot.mode == 'RGBA':
        # RGBAの場合は白背景で合成してRGBに変換
        rgb_shot = Image.new('RGB', shot.size, (255, 255, 255))
        rgb_shot.paste(shot, mask=shot.split()[3])  # アルファチャンネルをマスクとして使用
        rgb_shot.save(buffered, format="JPEG", quality=quality, optimize=True)
    else:
        shot.convert('RGB').save(buffered, format="JPEG", quality=quality, optimize=True)
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    x, y = pyautogui.position()
    return {"status": "success", "data": img_str, "mouse_position": {"x": x, "y": y}}


def get_screen_size() -> Dict[str, Any]:
    """画面サイズを取得する。物理解像度と論理解像度の比率（スケール）も返す"""
    width, height = pyautogui.size()
    # スクリーンショットを一時的に撮って物理サイズを確認
    shot = pyautogui.screenshot()
    phys_width, phys_height = shot.size
    scale_x = phys_width / width
    scale_y = phys_height / height

    return {
        "status": "success",
        "width": width,
        "height": height,
        "physical_width": phys_width,
        "physical_height": phys_height,
        "scale": scale_x
    }
