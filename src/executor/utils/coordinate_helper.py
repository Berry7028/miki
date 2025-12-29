"""座標変換とスケーリングのヘルパー関数"""
import pyautogui


def calculate_scale_factors():
    """
    ディスプレイのスケーリング係数を計算する
    Retina等でのスクリーンショットと論理座標の差を考慮
    """
    screen_w, screen_h = pyautogui.size()
    # 実際のスクリーンショットのサイズを取得
    shot = pyautogui.screenshot()
    img_w, img_h = shot.size
    
    scale_x = img_w / screen_w
    scale_y = img_h / screen_h
    
    return scale_x, scale_y


def scale_coordinates(x, y, scale_x, scale_y):
    """座標をスケーリングする"""
    return x * scale_x, y * scale_y
