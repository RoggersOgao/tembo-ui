// slug-utils.ts
export interface SlugOptions {
  /**
   * Keep numbers in the slug (default: true)
   */
  keepNumbers?: boolean;
  
  /**
   * Keep accented characters by converting them to ASCII (default: true)
   */
  keepAccentedChars?: boolean;
  
  /**
   * Keep special characters like &, @, etc. (default: false)
   */
  keepSpecialChars?: boolean;
  
  /**
   * Separator character (default: '-')
   */
  separator?: string;
  
  /**
   * Maximum length of the slug (default: 100)
   */
  maxLength?: number;
  
  /**
   * Convert to lowercase (default: true)
   */
  lowercase?: boolean;
  
  /**
   * Remove stop words (common words like 'a', 'the', etc.)
   */
  removeStopWords?: boolean;
  
  /**
   * Custom stop words to remove
   */
  customStopWords?: string[];
  
  /**
   * Preserve certain words or phrases
   */
  preserveWords?: string[];
  
  /**
   * Append timestamp or random string for uniqueness
   */
  makeUnique?: boolean;
  
  /**
   * Use different strategies: 'simple', 'seo-optimized', 'human-readable'
   */
  strategy?: 'simple' | 'seo-optimized' | 'human-readable';
}

// Common stop words for English
const DEFAULT_STOP_WORDS = [
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'can', 'may', 'might', 'must', 'shall', 'from', 'that', 'this',
  'these', 'those', 'there', 'here', 'where', 'when', 'what', 'which',
  'who', 'whom', 'how', 'why', 'then', 'than', 'so', 'such', 'as', 'it',
  'its', 'it\'s', 'they', 'them', 'their', 'i', 'me', 'my', 'mine', 'we',
  'us', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him', 'his', 'she',
  'her', 'hers'
];

// Common special character mappings
const SPECIAL_CHAR_MAP: Record<string, string> = {
  '&': 'and',
  '@': 'at',
  '%': 'percent',
  '#': 'hash',
  '$': 'dollar',
  '€': 'euro',
  '£': 'pound',
  '¥': 'yen',
  '₹': 'rupee',
  '©': 'copyright',
  '®': 'registered',
  '™': 'trademark',
  '°': 'degree',
  '×': 'x',
  '÷': 'divided-by',
  '±': 'plus-minus',
  '≠': 'not-equal',
  '≤': 'less-equal',
  '≥': 'greater-equal',
  '≈': 'approximately',
  '∞': 'infinity',
  'µ': 'micro',
  '∂': 'partial',
  '∆': 'delta',
  '∑': 'sum',
  '∏': 'product',
  'π': 'pi',
  '√': 'root',
  '∫': 'integral',
  '→': 'to',
  '←': 'from',
  '↑': 'up',
  '↓': 'down',
  '↔': 'left-right',
  '↕': 'up-down',
  '⇄': 'exchange',
  '⇆': 'exchange-alt',
  '⇌': 'reversible',
  '⇋': 'reversible-alt',
  '⇔': 'iff',
  '⇕': 'iff-alt',
  '∀': 'forall',
  '∃': 'exists',
  '∄': 'not-exists',
  '∅': 'empty',
  '∈': 'in',
  '∉': 'not-in',
  '∋': 'contains',
  '∌': 'not-contains',
  '⊂': 'subset',
  '⊃': 'superset',
  '⊄': 'not-subset',
  '⊅': 'not-superset',
  '⊆': 'subset-equal',
  '⊇': 'superset-equal',
  '⊈': 'not-subset-equal',
  '⊉': 'not-superset-equal',
  '⊕': 'xor',
  '⊗': 'tensor',
  '⊙': 'odot',
  '⊚': 'circled',
  '⊛': 'circled-star',
  '⊝': 'circled-dash',
  '⊞': 'box-plus',
  '⊟': 'box-minus',
  '⊠': 'box-times',
  '⊡': 'box-dot',
  '⊢': 'turnstile',
  '⊣': 'reverse-turnstile',
  '⊤': 'top',
  '⊥': 'bottom',
  '⊧': 'models',
  '⊨': 'true',
  '⊩': 'forces',
  '⊪': 'double-forces',
  '⊫': 'triple-forces',
  '⊬': 'not-forces',
  '⊭': 'not-double-forces',
  '⊮': 'not-triple-forces',
  '⊯': 'not-quad-forces',
  '⊰': 'precedes',
  '⊱': 'succeeds',
  '⊲': 'normal-subgroup',
  '⊳': 'contains-normal',
  '⊴': 'normal-subgroup-equal',
  '⊵': 'contains-normal-equal',
  '⊶': 'original',
  '⊷': 'image',
  '⊸': 'multimap',
  '⊹': 'hermitian',
  '⊺': 'intercal',
  '⊻': 'xor',
  '⊼': 'nand',
  '⊽': 'nor',
  '⊾': 'right-angle',
  '⊿': 'right-triangle',
  '⋀': 'big-wedge',
  '⋁': 'big-vee',
  '⋂': 'big-cap',
  '⋃': 'big-cup',
  '⋄': 'diamond',
  '⋅': 'dot',
  '⋆': 'star',
  '⋇': 'division-times',
  '⋈': 'bowtie',
  '⋉': 'left-times',
  '⋊': 'right-times',
  '⋋': 'left-semidirect',
  '⋌': 'right-semidirect',
  '⋍': 'reversed-tilde',
  '⋎': 'curly-vee',
  '⋏': 'curly-wedge',
  '⋐': 'double-subset',
  '⋑': 'double-superset',
  '⋒': 'double-intersection',
  '⋓': 'double-union',
  '⋔': 'pitchfork',
  '⋕': 'equal-parallel',
  '⋖': 'less-dot',
  '⋗': 'greater-dot',
  '⋘': 'very-much-less',
  '⋙': 'very-much-greater',
  '⋚': 'less-equal-greater',
  '⋛': 'greater-equal-less',
  '⋜': 'equal-less',
  '⋝': 'equal-greater',
  '⋞': 'equal-less-or-greater',
  '⋟': 'equal-greater-or-less',
  '⋠': 'not-less-or-equal',
  '⋡': 'not-greater-or-equal',
  '⋢': 'not-square-subset-or-equal',
  '⋣': 'not-square-superset-or-equal',
  '⋤': 'square-subset-not-equal',
  '⋥': 'square-superset-not-equal',
  '⋦': 'less-not-equivalent',
  '⋧': 'greater-not-equivalent',
  '⋨': 'precedes-not-equivalent',
  '⋩': 'succeeds-not-equivalent',
  '⋪': 'not-normal-subgroup',
  '⋫': 'not-contains-normal',
  '⋬': 'not-normal-subgroup-equal',
  '⋭': 'not-contains-normal-equal',
  '⋮': 'vertical-ellipsis',
  '⋯': 'midline-horizontal-ellipsis',
  '⋰': 'up-right-diagonal-ellipsis',
  '⋱': 'down-right-diagonal-ellipsis',
  '⋲': 'element-with-vertical-bar',
  '⋳': 'element-with-two-horizontal-strokes',
  '⋴': 'element-with-overbar',
  '⋵': 'small-element-with-overbar',
  '⋶': 'element-with-underbar',
  '⋷': 'element-with-two-strokes',
  '⋸': 'contains-with-long-horizontal-stroke',
  '⋹': 'contains-with-vertical-bar-at-end-of-horizontal-stroke',
  '⋺': 'small-contains-with-vertical-bar-at-end-of-horizontal-stroke',
  '⋻': 'contains-with-overbar',
  '⋼': 'small-contains-with-overbar',
  '⋽': 'z-notation-bag-membership',
  '⋾': 'diameter-sign',
  '⋿': 'electric-arrow'
};

// Accented character to ASCII mapping
const ACCENTED_CHAR_MAP: Record<string, string> = {
  // Lowercase letters
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
  'ā': 'a', 'ą': 'a', 'æ': 'ae',
  'ç': 'c', 'č': 'c', 'ć': 'c', 'ĉ': 'c',
  'ď': 'd', 'đ': 'd',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ę': 'e',
  'ě': 'e', 'ė': 'e',
  'ƒ': 'f',
  'ğ': 'g', 'ĝ': 'g',
  'ħ': 'h',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'į': 'i',
  'ı': 'i',
  'ĵ': 'j',
  'ķ': 'k',
  'ł': 'l', 'ľ': 'l', 'ĺ': 'l',
  'ñ': 'n', 'ń': 'n', 'ņ': 'n', 'ň': 'n',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ō': 'o',
  'ø': 'o', 'ő': 'o', 'œ': 'oe',
  'þ': 'th',
  'ř': 'r',
  'ś': 's', 'š': 's', 'ş': 's', 'ș': 's', 'ß': 'ss',
  'ť': 't',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ů': 'u',
  'ű': 'u',
  'ý': 'y', 'ÿ': 'y', 'ŷ': 'y',
  'ż': 'z', 'ź': 'z', 'ž': 'z',
  
  // Uppercase letters
  'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A', 'Ã': 'A', 'Å': 'A',
  'Ā': 'A', 'Ą': 'A', 'Æ': 'AE',
  'Ç': 'C', 'Č': 'C', 'Ć': 'C', 'Ĉ': 'C',
  'Ď': 'D', 'Đ': 'D',
  'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Ē': 'E', 'Ę': 'E',
  'Ě': 'E', 'Ė': 'E',
  'Ğ': 'G', 'Ĝ': 'G',
  'Ĥ': 'H', 'Ħ': 'H',
  'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I', 'Ī': 'I', 'Į': 'I',
  'İ': 'I',
  'Ĵ': 'J',
  'Ķ': 'K',
  'Ł': 'L', 'Ľ': 'L', 'Ĺ': 'L',
  'Ñ': 'N', 'Ń': 'N', 'Ņ': 'N', 'Ň': 'N',
  'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O', 'Õ': 'O', 'Ō': 'O',
  'Ø': 'O', 'Ő': 'O', 'Œ': 'OE',
  'Þ': 'TH',
  'Ř': 'R',
  'Ś': 'S', 'Š': 'S', 'Ş': 'S', 'Ș': 'S',
  'Ť': 'T',
  'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U', 'Ū': 'U', 'Ů': 'U',
  'Ű': 'U',
  'Ý': 'Y', 'Ÿ': 'Y', 'Ŷ': 'Y',
  'Ż': 'Z', 'Ź': 'Z', 'Ž': 'Z',
};

export function generateSlugFromName(
  name: string, 
  options: SlugOptions = {}
): string {
  const {
    keepNumbers = true,
    keepAccentedChars = true,
    keepSpecialChars = false,
    separator = '-',
    maxLength = 100,
    lowercase = true,
    removeStopWords = false,
    customStopWords = [],
    preserveWords = [],
    makeUnique = false,
    strategy = 'seo-optimized'
  } = options;

  if (!name || typeof name !== 'string') {
    return '';
  }

  let slug = name.trim();
  
  // Apply strategy-based preprocessing
  switch (strategy) {
    case 'seo-optimized':
      // Remove company/organization suffixes for SEO
      slug = slug.replace(/\b(inc|llc|ltd|corp|corporation|company|co|group)\b\.?/gi, '');
      break;
      
    case 'human-readable':
      // Keep more words, longer slugs
      break;
      
    case 'simple':
      // Minimal processing
      break;
  }

  // Handle preserved words - temporarily replace them with placeholders
  const preservedMap = new Map<string, string>();
  if (preserveWords && preserveWords.length > 0) {
    preserveWords.forEach((word, index) => {
      if (slug.includes(word)) {
        const placeholder = `__PRESERVED_${index}__`;
        preservedMap.set(placeholder, word);
        slug = slug.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
      }
    });
  }

  // Convert accented characters to ASCII
  if (keepAccentedChars) {
    slug = slug.replace(/[^\u0000-\u007F]/g, char => 
      ACCENTED_CHAR_MAP[char] || char
    );
  }

  // Handle special characters
  if (!keepSpecialChars) {
    // Replace special characters with words or remove them
    slug = slug.replace(/[^\w\s-]/g, char => {
      // Check if it's a special character with a mapping
      if (SPECIAL_CHAR_MAP[char]) {
        return ` ${SPECIAL_CHAR_MAP[char]} `;
      }
      return ' ';
    });
  }

  // Remove or keep numbers
  if (!keepNumbers) {
    slug = slug.replace(/\d+/g, '');
  }

  // Remove stop words if enabled
  if (removeStopWords) {
    const allStopWords = [...DEFAULT_STOP_WORDS, ...customStopWords];
    const stopWordsPattern = new RegExp(
      `\\b(${allStopWords.join('|')})\\b`,
      'gi'
    );
    slug = slug.replace(stopWordsPattern, ' ');
  }

  // Clean up the slug
  slug = slug
    // Convert to lowercase if specified
    .replace(lowercase ? /./g : /^$/g, char => lowercase ? char.toLowerCase() : char)
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Replace spaces with separator
    .replace(/\s+/g, separator)
    // Replace multiple separators with single separator
    .replace(new RegExp(`${separator}+`, 'g'), separator)
    // Remove leading/trailing separators
    .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');

  // Restore preserved words
  preservedMap.forEach((word, placeholder) => {
    slug = slug.replace(new RegExp(placeholder, 'g'), word);
  });

  // Trim to max length while keeping word boundaries
  if (slug.length > maxLength) {
    if (separator && slug.includes(separator)) {
      // Try to cut at the last separator before maxLength
      const lastSeparatorIndex = slug.lastIndexOf(separator, maxLength - 1);
      if (lastSeparatorIndex > 0) {
        slug = slug.substring(0, lastSeparatorIndex);
      } else {
        // If no separator found, hard cut
        slug = slug.substring(0, maxLength);
        // Remove trailing partial word
        const lastSeparator = slug.lastIndexOf(separator);
        if (lastSeparator > 0) {
          slug = slug.substring(0, lastSeparator);
        }
      }
    } else {
      slug = slug.substring(0, maxLength);
    }
  }

  // Make unique if requested
  if (makeUnique) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const uniquePart = `${separator}${timestamp}${random}`;
    
    // Ensure total length doesn't exceed maxLength
    if (slug.length + uniquePart.length <= maxLength) {
      slug += uniquePart;
    } else {
      // Trim slug to make room for unique part
      const availableLength = maxLength - uniquePart.length;
      if (availableLength > 0) {
        slug = slug.substring(0, availableLength) + uniquePart;
      } else {
        // If no room, just use unique part
        slug = uniquePart.substring(1); // Remove leading separator
      }
    }
  }

  // Final cleanup
  slug = slug
    .replace(new RegExp(`${separator}+$`), '')
    .replace(new RegExp(`^${separator}+`), '');

  // If slug is empty after all processing, generate a fallback
  if (!slug) {
    const fallback = 'untitled-' + Date.now().toString(36);
    return fallback.substring(0, Math.min(fallback.length, maxLength));
  }

  return slug;
}

// Alternative: Generate slug from multiple fields
export function generateSlugFromFields(
  fields: Record<string, string>,
  options: SlugOptions = {}
): string {
  const {
    separator = '-',
    fieldOrder = ['name', 'type', 'location', 'id'],
    includeFields = []
  } = options as SlugOptions & {
    fieldOrder?: string[];
    includeFields?: string[];
  };

  const parts: string[] = [];

  // Add fields in specified order
  fieldOrder.forEach(field => {
    if (fields[field] && fields[field].trim()) {
      parts.push(generateSlugFromName(fields[field], { ...options, separator: ' ' }));
    }
  });

  // Add any additional fields
  includeFields.forEach(field => {
    if (fields[field] && fields[field].trim() && !fieldOrder.includes(field)) {
      parts.push(generateSlugFromName(fields[field], { ...options, separator: ' ' }));
    }
  });

  // Join parts with separator
  let slug = parts.filter(Boolean).join(separator);

  // Clean up
  slug = slug
    .replace(new RegExp(`${separator}+`, 'g'), separator)
    .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');

  return slug;
}

// Check if slug is unique (would need database integration)
export async function ensureUniqueSlug(
  baseSlug: string,
  checkUnique: (slug: string) => Promise<boolean>,
  options: {
    separator?: string;
    maxAttempts?: number;
  } = {}
): Promise<string> {
  const { separator = '-', maxAttempts = 10 } = options;
  
  let slug = baseSlug;
  let attempt = 1;
  
  while (attempt <= maxAttempts) {
    const isUnique = await checkUnique(slug);
    if (isUnique) {
      return slug;
    }
    
    // Append incrementing number
    slug = `${baseSlug}${separator}${attempt}`;
    attempt++;
  }
  
  // If all attempts fail, append timestamp
  return `${baseSlug}${separator}${Date.now().toString(36)}`;
}

// Generate URL-friendly slug from various inputs
export function createSlug(...inputs: Array<string | number>): string {
  const parts = inputs
    .filter(input => input != null && input !== '')
    .map(input => String(input).trim())
    .join(' ')
    .toLowerCase();

  return generateSlugFromName(parts);
}

// Create slug with parent hierarchy
export function createHierarchicalSlug(
  name: string,
  parentSlug?: string,
  options: SlugOptions = {}
): string {
  const { separator = '-', lowercase = true } = options;
  
  const nameSlug = generateSlugFromName(name, options);
  
  if (!parentSlug) {
    return nameSlug;
  }
  
  return `${parentSlug}${separator}${nameSlug}`;
}

// Slug validation utility
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  
  // Basic slug regex: lowercase letters, numbers, hyphens
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  
  // Additional constraints
  const isTooShort = slug.length < 2;
  const isTooLong = slug.length > 200;
  const startsOrEndsWithHyphen = slug.startsWith('-') || slug.endsWith('-');
  const hasConsecutiveHyphens = /--/.test(slug);
  
  return (
    slugRegex.test(slug) &&
    !isTooShort &&
    !isTooLong &&
    !startsOrEndsWithHyphen &&
    !hasConsecutiveHyphens
  );
}

// Generate SEO-friendly slug suggestions
export function generateSlugSuggestions(
  name: string,
  count: number = 3
): string[] {
  const suggestions: string[] = [];
  
  // Base suggestion
  suggestions.push(generateSlugFromName(name));
  
  // Variations
  for (let i = 1; i < count; i++) {
    const options: SlugOptions = {
      removeStopWords: i % 2 === 0,
      strategy: i % 3 === 0 ? 'human-readable' : 'seo-optimized',
      makeUnique: i === count - 1 // Make last one unique
    };
    suggestions.push(generateSlugFromName(name, options));
  }
  
  return [...new Set(suggestions)]; // Remove duplicates
}

