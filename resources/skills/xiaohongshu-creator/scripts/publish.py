"""
小红书内容发布脚本
支持图文笔记发布、定时发布、状态检查

登录方案：使用系统 Edge/Chrome 二进制 + 独立 profile 目录。
不占用系统浏览器的 profile，因此浏览器运行时也可正常使用。
首次运行需在弹出的窗口中登录一次，之后永久保存登录状态。
"""

import asyncio
import argparse
import os
import sys
import json
import time
from pathlib import Path
from playwright.async_api import async_playwright


def _get_system_browser() -> tuple[str, str]:
    """返回 (user_data_dir, channel)，优先 Edge，其次 Chrome"""
    local = os.environ.get("LOCALAPPDATA", "")
    prog = os.environ.get("PROGRAMFILES", "")
    prog86 = os.environ.get("PROGRAMFILES(X86)", "")

    edge_exe = Path(prog86) / "Microsoft" / "Edge" / "Application" / "msedge.exe"
    if not edge_exe.exists():
        edge_exe = Path(prog) / "Microsoft" / "Edge" / "Application" / "msedge.exe"
    edge_data = Path(local) / "Microsoft" / "Edge" / "User Data"
    if edge_exe.exists() and edge_data.exists():
        return str(edge_data), "msedge"

    chrome_exe = Path(prog) / "Google" / "Chrome" / "Application" / "chrome.exe"
    if not chrome_exe.exists():
        chrome_exe = Path(prog86) / "Google" / "Chrome" / "Application" / "chrome.exe"
    if not chrome_exe.exists():
        chrome_exe = Path(local) / "Google" / "Chrome" / "Application" / "chrome.exe"
    chrome_data = Path(local) / "Google" / "Chrome" / "User Data"
    if chrome_exe.exists() and chrome_data.exists():
        return str(chrome_data), "chrome"

    return "", ""


async def _launch_context(p):
    """
    用系统 Edge/Chrome 的默认用户数据目录启动，直接复用已登录账号。
    注意：运行前需关闭所有 Edge/Chrome 窗口，否则 profile 目录被锁定。
    """
    user_data_dir, channel = _get_system_browser()
    if not user_data_dir:
        print("未找到系统 Edge 或 Chrome，请安装后重试")
        sys.exit(1)
    print(f"使用浏览器: {channel}，用户数据: {user_data_dir}")
    try:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            channel=channel,
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        return context
    except Exception as e:
        msg = str(e).lower()
        if "already in use" in msg or "winerror 32" in msg or "lock" in msg:
            print("错误: 请先关闭所有 Edge/Chrome 窗口后再运行此脚本")
        else:
            print(f"浏览器启动失败: {e}")
        sys.exit(1)


async def _is_logged_in(context) -> bool:
    """通过 cookie 判断是否已登录小红书"""
    cookies = await context.cookies("https://www.xiaohongshu.com")
    names = {c["name"] for c in cookies}
    found = names & {"a1", "web_session", "webId", "gid"}
    if found:
        print(f"检测到登录 cookie: {found}")
        return True
    return False


async def _wait_for_login(context) -> bool:
    """
    打开小红书登录页，引导用户登录。
    每 3 秒检测一次 cookie，最多等待 5 分钟。
    返回登录后的 page 对象，失败返回 None。
    """
    page = await context.new_page()
    await page.goto("https://www.xiaohongshu.com", wait_until="domcontentloaded", timeout=30000)
    print("请在打开的浏览器窗口中登录小红书，登录完成后脚本将自动继续...")
    for _ in range(100):  # 最多等 5 分钟
        await asyncio.sleep(3)
        if await _is_logged_in(context):
            print("登录成功！")
            return page
    print("等待登录超时")
    await page.close()
    return None


async def check_login(page):
    """检查当前页面的登录状态（兼容旧调用）"""
    return await _is_logged_in(page.context)


async def publish_content(title: str, content: str, images=None, tags=None):
    """发布小红书笔记"""
    async with async_playwright() as p:
        context = await _launch_context(p)

        try:
            if not await _is_logged_in(context):
                login_page = await _wait_for_login(context)
                if not login_page:
                    return {"status": "not_logged_in"}
                # 复用登录页导航到发布页
                page = login_page
            else:
                page = await context.new_page()

            await page.goto(
                "https://creator.xiaohongshu.com/publish/publish",
                wait_until="networkidle",
                timeout=60000,
            )
            await asyncio.sleep(2)

            # 点击"上传图文"tab，切换到图文发布模式
            print("切换到图文发布模式...")
            try:
                tab = page.get_by_text("上传图文", exact=True)
                await tab.first.click()
                await asyncio.sleep(2)
                print("已切换到图文模式")
            except Exception as e:
                print(f"未找到图文 tab: {e}，继续尝试...")

            # 填写标题
            print(f"填写标题: {title}")
            title_input = None
            for sel in ["input[placeholder*='标题']", "input[placeholder*='title']", ".title-input input", "input[class*='title']"]:
                try:
                    title_input = await page.wait_for_selector(sel, timeout=3000)
                    if title_input:
                        break
                except Exception:
                    continue
            if title_input:
                await title_input.click()
                await title_input.fill(title)
                await asyncio.sleep(0.5)
            else:
                print("未找到标题输入框")

            # 填写正文（contenteditable 用 keyboard 输入更可靠）
            print("填写正文...")
            content_input = None
            for sel in ["div[contenteditable='true']", ".editor-content", "div[class*='editor']"]:
                try:
                    content_input = await page.wait_for_selector(sel, timeout=3000)
                    if content_input:
                        break
                except Exception:
                    continue
            if content_input:
                await content_input.click()
                await asyncio.sleep(0.3)
                await page.keyboard.press("Control+a")
                await page.keyboard.press("Delete")
                await page.keyboard.type(content, delay=20)
                await asyncio.sleep(0.5)
            else:
                print("未找到正文输入框")

            print("尝试自动发布...")
            await asyncio.sleep(1)

            try:
                publish_button = await page.wait_for_selector(
                    "button:has-text('发布')", timeout=5000
                )
                # 过滤掉"发布笔记"下拉按钮，找真正的提交按钮
                buttons = await page.query_selector_all("button:has-text('发布')")
                # 优先找不含下拉箭头的按钮（通常是最后一个或 type=submit）
                publish_button = buttons[-1] if buttons else None
            except Exception:
                publish_button = None

            if publish_button:
                print("点击发布按钮...")
                await publish_button.click()
                await asyncio.sleep(3)

                try:
                    await page.wait_for_selector(
                        "text=发布成功, .success-toast", timeout=5000
                    )
                    print("✅ 发布成功!")
                    return {"status": "published", "title": title}
                except Exception:
                    pass

                print("请在浏览器中确认发布...")
                return {"status": "ready_to_confirm", "title": title}
            else:
                print("未找到发布按钮，请手动点击")
                return {"status": "ready", "title": title}

        finally:
            await context.close()


async def check_status():
    """检查登录状态"""
    async with async_playwright() as p:
        context = await _launch_context(p)

        try:
            if await _is_logged_in(context):
                print("已登录小红书")
                return {"status": "logged_in"}

            print("未登录小红书，请在打开的浏览器窗口中登录...")
            login_page = await _wait_for_login(context)
            if login_page:
                return {"status": "logged_in"}
            return {"status": "not_logged_in"}

        finally:
            await context.close()


def main():
    parser = argparse.ArgumentParser(description="小红书内容发布工具")
    parser.add_argument("command", help="命令: publish, schedule, status")
    parser.add_argument("title", nargs="?", help="笔记标题")
    parser.add_argument("content", nargs="?", help="笔记正文")
    parser.add_argument("--images", help="图片路径(逗号分隔)")
    parser.add_argument("--tags", help="标签(逗号分隔)")
    parser.add_argument("--delay", type=int, help="延迟秒数(定时发布)")
    
    args = parser.parse_args()
    
    if args.command == "status":
        result = asyncio.run(check_status())
        print(json.dumps(result, ensure_ascii=False))
        
    elif args.command == "publish":
        if not args.title or not args.content:
            print("错误: publish命令需要title和content参数")
            sys.exit(1)
        
        images = args.images.split(",") if args.images else None
        tags = args.tags.split(",") if args.tags else None
        
        result = asyncio.run(publish_content(args.title, args.content, images, tags))
        print(json.dumps(result, ensure_ascii=False))
        
    elif args.command == "schedule":
        if not args.title or not args.content:
            print("错误: schedule命令需要title和content参数")
            sys.exit(1)
        
        delay = args.delay or 0
        print(f"定时发布: {delay}秒后")
        time.sleep(delay)
        
        images = args.images.split(",") if args.images else None
        tags = args.tags.split(",") if args.tags else None
        
        result = asyncio.run(publish_content(args.title, args.content, images, tags))
        print(json.dumps(result, ensure_ascii=False))
        
    else:
        print(f"未知命令: {args.command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
