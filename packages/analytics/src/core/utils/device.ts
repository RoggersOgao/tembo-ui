
import { DeviceInfo } from '../types';
import { DEVICE_TYPES, DeviceType } from '../constants';

export function getDeviceInfo(): DeviceInfo {
    if (typeof window === 'undefined') {
        return {
            deviceType: DEVICE_TYPES.UNKNOWN,
            browser: 'server',
            os: 'server',
        };
    }

    const ua = navigator.userAgent;

    let deviceType: DeviceType = DEVICE_TYPES.UNKNOWN;
    if (/android/i.test(ua)) {
        deviceType = DEVICE_TYPES.MOBILE;
    } else if (/iPad|iPhone|iPod/.test(ua)) {
        deviceType = DEVICE_TYPES.MOBILE;
    } else if (/tablet/i.test(ua)) {
        deviceType = DEVICE_TYPES.TABLET;
    } else if (/windows|mac|linux/i.test(ua) && !/mobile/i.test(ua)) {
        deviceType = DEVICE_TYPES.DESKTOP;
    }

    let browser = 'unknown';
    if (/chrome/i.test(ua) && !/edge/i.test(ua)) {
        browser = 'chrome';
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
        browser = 'safari';
    } else if (/firefox/i.test(ua)) {
        browser = 'firefox';
    } else if (/edge/i.test(ua)) {
        browser = 'edge';
    } else if (/msie|trident/i.test(ua)) {
        browser = 'ie';
    }

    let os = 'unknown';
    if (/windows/i.test(ua)) {
        os = 'windows';
    } else if (/mac/i.test(ua)) {
        os = 'macos';
    } else if (/linux/i.test(ua)) {
        os = 'linux';
    } else if (/android/i.test(ua)) {
        os = 'android';
    } else if (/ios|iphone|ipad/i.test(ua)) {
        os = 'ios';
    }

    return {
        deviceType,
        browser,
        os,
        screenWidth: window.screen?.width,
        screenHeight: window.screen?.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
    };
}