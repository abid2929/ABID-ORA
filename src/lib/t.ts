/* Translation tokens. Pages are built once as templates; tools/publish.php (and the admin's
   "Publish" button) replace these tokens with each language's text.
   t('key')    -> trusted HTML from the dictionary
   ta('key')   -> text escaped for an attribute
   u('page')   -> relative link to another page in the same language
   ROOT        -> relative path to the site root */
export const t = (k: string): string => `{{${k}}}`;
export const ta = (k: string): string => `{{attr:${k}}}`;
export const u = (page: string): string => `{{U:${page}}}`;
export const ROOT = '{{ROOT}}';
