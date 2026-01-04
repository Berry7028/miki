"""スクリーンショット取得とハイライト描画"""
import pyautogui
import base64
from io import BytesIO
from PIL import Image, ImageDraw


def _calculate_image_scale_factors(img):
    """
    画像とスクリーンサイズから倍率を計算
    Retina等でのスクリーンショットと論理座標の差を考慮
    """
    screen_w, screen_h = pyautogui.size()
    img_w, img_h = img.size
    return img_w / screen_w, img_h / screen_h


def draw_point_on_screenshot(img, x, y, radius=15, color="red"):
    """スクリーンショット上の指定座標にハイライト（赤い点）を描画する"""
    draw = ImageDraw.Draw(img)

    # ディスプレイのスケーリング（Retina等）を考慮
    scale_x, scale_y = _calculate_image_scale_factors(img)

    ix, iy = x * scale_x, y * scale_y

    left_up = (ix - radius, iy - radius)
    right_down = (ix + radius, iy + radius)
    draw.ellipse([left_up, right_down], fill=color, outline="white", width=2)
    return img


def screenshot(highlight_pos=None, max_size=1920, quality=85):
    """
    画面のスクリーンショットを撮り、Base64文字列で返し、現在のマウス位置も提供する
    
    Args:
        highlight_pos: ハイライト位置 {"x": int, "y": int}
        max_size: 最大幅または高さ（ピクセル）。これを超える場合は縮小
        quality: JPEG品質（1-100）。デフォルト85で高品質かつ軽量
    """
    shot = pyautogui.screenshot()
    
    # 解像度の最適化: 大きすぎる画像は縮小
    original_width, original_height = shot.size
    if original_width > max_size or original_height > max_size:
        # アスペクト比を保持して縮小
        ratio = min(max_size / original_width, max_size / original_height)
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)
        shot = shot.resize((new_width, new_height), Image.LANCZOS)
        
        # ハイライト位置も縮小比率に合わせて調整
        if highlight_pos:
            highlight_pos = {
                'x': int(highlight_pos['x'] * ratio),
                'y': int(highlight_pos['y'] * ratio)
            }

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


def get_screen_size():
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
