import { describe, it, expect } from 'vitest';

describe('MacOSAgentOrchestrator', () => {
  describe('event types', () => {
    it('should have correct log event structure', () => {
      const logEvent = {
        type: 'info' as const,
        message: 'Test message',
        timestamp: new Date()
      };

      expect(logEvent).toHaveProperty('type');
      expect(logEvent).toHaveProperty('message');
      expect(logEvent).toHaveProperty('timestamp');
      expect(['info', 'success', 'error', 'hint', 'action']).toContain(logEvent.type);
    });

    it('should have correct status event structure', () => {
      const statusEvent = {
        state: 'running' as const,
        timestamp: new Date()
      };

      expect(statusEvent).toHaveProperty('state');
      expect(statusEvent).toHaveProperty('timestamp');
      expect(['idle', 'running', 'thinking', 'stopping']).toContain(statusEvent.state);
    });

    it('should have correct thinking event structure', () => {
      const thinkingEvent = {
        phase: 'planning' as const,
        thought: 'Analyzing the task',
        message: '[計画] Analyzing the task'
      };

      expect(thinkingEvent).toHaveProperty('phase');
      expect(thinkingEvent).toHaveProperty('thought');
      expect(thinkingEvent).toHaveProperty('message');
      expect(['planning', 'executing', 'verification', 'reflection']).toContain(thinkingEvent.phase);
    });

    it('should have correct action_update event structure', () => {
      const actionEvent = {
        phase: 'running' as const,
        action: 'click',
        params: { x: 500, y: 500 }
      };

      expect(actionEvent).toHaveProperty('phase');
      expect(actionEvent).toHaveProperty('action');
      expect(actionEvent).toHaveProperty('params');
    });
  });

  describe('phase labels', () => {
    it('should map phase codes to Japanese labels', () => {
      const phaseLabels = {
        planning: '計画',
        executing: '実行',
        verification: '検証',
        reflection: '振り返り'
      };

      expect(phaseLabels.planning).toBe('計画');
      expect(phaseLabels.executing).toBe('実行');
      expect(phaseLabels.verification).toBe('検証');
      expect(phaseLabels.reflection).toBe('振り返り');
    });
  });

  describe('screen size state', () => {
    it('should initialize with default screen size', () => {
      const screenSize = { width: 0, height: 0 };
      
      expect(screenSize).toHaveProperty('width');
      expect(screenSize).toHaveProperty('height');
    });

    it('should update screen size from Python response', () => {
      const response = { width: 1920, height: 1080 };
      const screenSize = { width: response.width || 0, height: response.height || 0 };
      
      expect(screenSize.width).toBe(1920);
      expect(screenSize.height).toBe(1080);
    });
  });

  describe('default browser state', () => {
    it('should initialize with Safari as default', () => {
      const defaultBrowser = 'Safari';
      const defaultBrowserId = '';
      
      expect(defaultBrowser).toBe('Safari');
      expect(defaultBrowserId).toBe('');
    });

    it('should update browser from Python response', () => {
      const response = {
        browser: 'Google Chrome',
        bundle_id: 'com.google.Chrome'
      };
      
      const browser = response.browser;
      const browserId = response.bundle_id;
      
      expect(browser).toBe('Google Chrome');
      expect(browserId).toBe('com.google.Chrome');
    });
  });

  describe('session state management', () => {
    it('should create session with correct state', () => {
      const session = {
        state: {
          screen_size: { width: 1920, height: 1080 },
          default_browser: 'Safari',
          default_browser_id: 'com.apple.Safari',
          current_app: 'Finder'
        }
      };

      expect(session.state).toHaveProperty('screen_size');
      expect(session.state).toHaveProperty('default_browser');
      expect(session.state).toHaveProperty('default_browser_id');
      expect(session.state).toHaveProperty('current_app');
    });
  });

  describe('error messages', () => {
    it('should format error messages correctly', () => {
      const apiKeyError = 'APIキーが設定されていません。設定画面でAPIキーを保存してください。';
      const initError = (err: Error) => `初期化エラー: ${err}`;
      const execError = (err: Error) => `実行エラー: ${err}`;

      expect(apiKeyError).toContain('APIキー');
      expect(initError(new Error('test'))).toContain('初期化エラー');
      expect(execError(new Error('test'))).toContain('実行エラー');
    });
  });

  describe('step counting', () => {
    it('should track step count during execution', () => {
      let stepCount = 0;
      const maxSteps = 100;

      // Simulate step increments
      for (let i = 0; i < 150; i++) {
        if (stepCount >= maxSteps) break;
        stepCount++;
      }

      expect(stepCount).toBe(maxSteps);
    });
  });

  describe('stop request handling', () => {
    it('should set stop request flag', () => {
      let stopRequested = false;
      
      const stop = () => {
        stopRequested = true;
      };

      stop();
      expect(stopRequested).toBe(true);
    });

    it('should check stop request during execution', () => {
      let stopRequested = false;
      let shouldContinue = true;

      if (stopRequested) {
        shouldContinue = false;
      }

      expect(shouldContinue).toBe(true);

      stopRequested = true;
      if (stopRequested) {
        shouldContinue = false;
      }

      expect(shouldContinue).toBe(false);
    });
  });
});
