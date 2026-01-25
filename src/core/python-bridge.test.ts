import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvePythonPath } from './python-bridge';

describe('PythonBridge', () => {
  describe('coordinate normalization logic', () => {
    it('should correctly calculate normalized coordinates', () => {
      const screenSize = { width: 1920, height: 1080 };
      
      // Replicate the normalization logic from MacOSToolSuite
      const normalize = (x: number, y: number) => ({
        x: Math.round((x / 1000) * screenSize.width),
        y: Math.round((y / 1000) * screenSize.height),
      });

      expect(normalize(500, 500)).toEqual({ x: 960, y: 540 });
      expect(normalize(0, 0)).toEqual({ x: 0, y: 0 });
      expect(normalize(1000, 1000)).toEqual({ x: 1920, y: 1080 });
    });

    it('should handle different screen sizes', () => {
      const screenSize = { width: 2560, height: 1440 };
      
      const normalize = (x: number, y: number) => ({
        x: Math.round((x / 1000) * screenSize.width),
        y: Math.round((y / 1000) * screenSize.height),
      });

      expect(normalize(500, 500)).toEqual({ x: 1280, y: 720 });
      expect(normalize(250, 750)).toEqual({ x: 640, y: 1080 });
    });
  });

  describe('JSON parsing', () => {
    it('should parse valid JSON responses', () => {
      const line = JSON.stringify({ status: 'success', data: 'test' });
      const parsed = JSON.parse(line);
      
      expect(parsed).toEqual({ status: 'success', data: 'test' });
    });

    it('should handle non-JSON lines gracefully', () => {
      const lines = [
        'Warning: some warning',
        '',
        '   ',
        'Debug output'
      ];

      lines.forEach(line => {
        if (!line.trim()) {
          expect(line.trim()).toBe('');
        } else {
          try {
            JSON.parse(line);
          } catch (e) {
            expect(e).toBeInstanceOf(SyntaxError);
          }
        }
      });
    });
  });

  describe('retry mechanism', () => {
    it('should calculate exponential backoff delay', () => {
      const getDelay = (attempt: number) => Math.pow(2, attempt) * 1000;

      expect(getDelay(0)).toBe(1000);   // 2^0 * 1000 = 1000ms
      expect(getDelay(1)).toBe(2000);   // 2^1 * 1000 = 2000ms
      expect(getDelay(2)).toBe(4000);   // 2^2 * 1000 = 4000ms
    });
  });

  describe('timeout calculation', () => {
    it('should use default timeout when not specified', () => {
      const defaultTimeout = 30000;
      const options = {};
      const timeout = options.timeout ?? defaultTimeout;

      expect(timeout).toBe(30000);
    });

    it('should use custom timeout when specified', () => {
      const defaultTimeout = 30000;
      const options = { timeout: 5000 };
      const timeout = options.timeout ?? defaultTimeout;

      expect(timeout).toBe(5000);
    });
  });

  describe('resolvePythonPath', () => {
    it('should prefer platform-specific path when no files exist', () => {
      const windowsPath = resolvePythonPath('/repo', 'win32', false);
      const unixPath = resolvePythonPath('/repo', 'darwin', false);

      expect(windowsPath.replace(/\\/g, '/')).toBe('/repo/venv/Scripts/python.exe');
      expect(unixPath.replace(/\\/g, '/')).toBe('/repo/venv/bin/python');
    });

    it('should return system python fallback when venv is missing', () => {
      const windowsFallback = resolvePythonPath('/repo', 'win32', true);
      const unixFallback = resolvePythonPath('/repo', 'linux', true);

      expect(windowsFallback).toBe('python.exe');
      expect(unixFallback).toBe('python3');
    });
  });
});
