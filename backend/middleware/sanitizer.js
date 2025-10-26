/* Simple request sanitization middleware
   - Recursively sanitizes strings in req.body, req.query, req.params
   - Removes potentially dangerous script tags and control characters
   This is a lightweight, framework-agnostic sanitizer. For production
   consider using well-tested libraries like DOMPurify or validator.js
*/
function sanitizeString(str) {
  if (typeof str !== 'string') return str
  // remove null bytes and control chars except newline/tab
  let s = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  // basic strip of <script> tags and their contents
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  // remove javascript: urls
  s = s.replace(/javascript:\s*/gi, '')
  // trim
  return s.trim()
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeObject)
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out[k] = v
    } else if (typeof v === 'string') {
      out[k] = sanitizeString(v)
    } else if (typeof v === 'object') {
      out[k] = sanitizeObject(v)
    } else {
      out[k] = v
    }
  }
  return out
}

module.exports = function requestSanitizer(req, res, next) {
  try {
    if (req.body) req.body = sanitizeObject(req.body)
    if (req.query) req.query = sanitizeObject(req.query)
    if (req.params) req.params = sanitizeObject(req.params)
  } catch (err) {
    // don't fail hard on sanitizer issues
    console.warn('Request sanitizer error:', err && err.message ? err.message : err)
  }
  return next()
}
