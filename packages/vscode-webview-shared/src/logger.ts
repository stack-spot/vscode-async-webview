/* eslint-disable no-console */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

class Logger {
  private enabled: Record<LogLevel, boolean> = {
    info: true,
    warn: true,
    error: true,
    debug: false,
  }

  private log(type: LogLevel, ...messages: any[]) {
    // @ts-ignore
    if (this.enabled[type]) console[type](`${type}:`, ...messages)
  }

  debug(...messages: any[]) {
    this.log('debug', ...messages)
  }

  info(...messages: any[]) {
    this.log('info', ...messages)
  }

  warn(...messages: any[]) {
    this.log('warn', ...messages)
  }

  error(...messages: any[]) {
    this.log('error', ...messages)
  }

  private setEnabled(type: LogLevel | undefined, value: boolean) {
    if (type) this.enabled[type] = value
    else {
      this.enabled.info = value
      this.enabled.warn = value
      this.enabled.error = value
      this.enabled.debug = value
    }
  }

  enable(type?: LogLevel) {
    this.setEnabled(type, true)
  }

  disable(type?: LogLevel) {
    this.setEnabled(type, false)
  } 
}

export const logger = new Logger()
