import sys
import os
import webview

def main():
    if getattr(sys, 'frozen', False):
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    
    html_path = os.path.join(base_dir, 'index.html')
    
    webview.create_window(
        title='NEON TETRIS - Cyberpunk Arcade',
        url=f'file:///{html_path.replace("\\", "/")}',
        width=1000,
        height=850,
        resizable=True,
        min_size=(800, 700),
        background_color='#070714'
    )
    webview.start()

if __name__ == '__main__':
    main()
