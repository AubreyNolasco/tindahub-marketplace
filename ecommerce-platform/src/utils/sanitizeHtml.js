import DOMPurify from 'dompurify'

const POLICY_TAGS = ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'blockquote', 'a', 'hr']

export function sanitizePolicyHtml(html = '') {
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS: POLICY_TAGS,
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  })
}
