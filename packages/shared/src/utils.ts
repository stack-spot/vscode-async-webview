export function errorToString(error: any): string {
  return error.message ?? (() => { 
    try { 
      return JSON.stringify(error) 
    } 
    catch { 
      return error.toString?.call(error) ?? 'Unknown error'
    }
  })()
}
