/*
 * Evidence Evaluator (D29)
 * ------------------------
 * Discretized predicates that answer each `evidence_rules` entry from the catalog
 * with a yes/no/count. Every check is grounded in language tokens or STL types —
 * never in identifier naming conventions.
 *
 * Inputs:
 *   - source text of the entire file
 *   - the detected pattern (carries class_name, class_text, base_class etc.)
 *   - the rule itself
 *
 * Output: number (count) or boolean. The ranker turns these into a final score.
 *
 * This is the JS interim implementation. The C++ microservice will eventually emit
 * `evidence_signals` natively (D29) and this file becomes a thin verifier.
 */

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ---- Helpers that work on a class-scoped slice of source text. ---- */

/** Return the text between `class <name> { ... };` for the given class, or '' if not found. */
function extractClassBody(sourceText, className) {
  const re = new RegExp(`\\b(class|struct)\\s+${escapeRegex(className)}\\b[^{]*\\{`);
  const m = re.exec(sourceText);
  if (!m) return '';
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < sourceText.length && depth > 0) {
    const c = sourceText[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    i += 1;
  }
  return sourceText.slice(m.index, i);
}

/** Return the inheritance list text after `class X :` up to `{`, or '' if no inheritance. */
function extractInheritanceClause(sourceText, className) {
  const re = new RegExp(`\\b(class|struct)\\s+${escapeRegex(className)}\\b\\s*(?:final\\s*)?(:[^{]+)\\{`);
  const m = re.exec(sourceText);
  return m ? m[2] : '';
}

/* ---- Evidence rule kinds. Each returns boolean or count. ---- */

function ruleDeletedMethod(rule, ctx) {
  const { className, classBody } = ctx;
  if (!classBody) return false;
  const escName = escapeRegex(className);
  switch (rule.method) {
    case 'copy_ctor':
      return new RegExp(`\\b${escName}\\s*\\(\\s*const\\s+${escName}\\s*&[^)]*\\)\\s*=\\s*delete`).test(classBody);
    case 'copy_assign':
      return new RegExp(`operator\\s*=\\s*\\(\\s*const\\s+${escName}\\s*&[^)]*\\)\\s*=\\s*delete`).test(classBody);
    case 'move_ctor':
      return new RegExp(`\\b${escName}\\s*\\(\\s*${escName}\\s*&&[^)]*\\)\\s*=\\s*delete`).test(classBody);
    case 'move_assign':
      return new RegExp(`operator\\s*=\\s*\\(\\s*${escName}\\s*&&[^)]*\\)\\s*=\\s*delete`).test(classBody);
    case 'destructor':
      return new RegExp(`~${escName}\\s*\\([^)]*\\)\\s*=\\s*delete`).test(classBody);
    default:
      return false;
  }
}

function ruleDefaultedMethod(rule, ctx) {
  const { className, classBody } = ctx;
  if (!classBody) return false;
  const escName = escapeRegex(className);
  if (rule.method === 'destructor') {
    return new RegExp(`~${escName}\\s*\\([^)]*\\)\\s*=\\s*default`).test(classBody);
  }
  return new RegExp(`${escName}\\s*\\([^)]*\\)\\s*=\\s*default`).test(classBody);
}

function ruleStaticLocal(rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  const ofType = String(rule.of_type || '').replace(/\{class_name\}/g, ctx.className);
  if (!ofType) return /\bstatic\s+\w/.test(classBody);
  return new RegExp(`\\bstatic\\s+${escapeRegex(ofType)}\\b`).test(classBody);
}

function ruleStaticMember(rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  const ofType = String(rule.of_type || '').replace(/\{class_name\}/g, ctx.className);
  const ptrOrRef = rule.ptr_or_ref ? '\\s*[*&]\\s*' : '\\s*';
  return new RegExp(`\\bstatic\\s+${escapeRegex(ofType)}${ptrOrRef}\\w+\\s*[;=]`).test(classBody);
}

function rulePureVirtualCount(_rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return 0;
  // Match `virtual ... = 0` patterns where the body is a method signature ending in `= 0`.
  const re = /\bvirtual\b[^;{]*=\s*0\s*[;,]/g;
  return (classBody.match(re) || []).length;
}

function ruleNonStaticDataMemberCount(_rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return 0;
  // Strip out method bodies first so member-vs-method is unambiguous.
  let body = classBody;
  // Remove nested {...} blocks (method bodies, ctor inits with braces).
  let depth = 0, out = '';
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '{') { if (depth === 0) out += '{'; depth += 1; continue; }
    if (c === '}') { depth -= 1; if (depth === 0) out += '}'; continue; }
    if (depth <= 1) out += c; // top-level class scope only
  }
  // Match `<type> <name>;` lines NOT preceded by `static`. Skip `using`, `typedef`, fn-decls (parens).
  const decls = out.match(/^[ \t]*[\w:<>,\s\*&]+\s+\w+\s*(?:=[^;]*)?;/gm) || [];
  return decls.filter(d => !/\bstatic\b/.test(d) && !/[\(\)]/.test(d)
    && !/^\s*(using|typedef|friend|public|private|protected)\b/.test(d)).length;
}

function ruleOverrideSpecifierCount(_rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return 0;
  return (classBody.match(/\boverride\b/g) || []).length;
}

function ruleFinalOnClass(_rule, ctx) {
  const { classBody, className } = ctx;
  if (!classBody) return false;
  return new RegExp(`\\b(class|struct)\\s+${escapeRegex(className)}\\s+final\\b`).test(classBody);
}

function ruleInheritancePresent(_rule, ctx) {
  return Boolean(extractInheritanceClause(ctx.sourceText, ctx.className));
}

function ruleNonSelfClassMember(_rule, ctx) {
  const { classBody, className } = ctx;
  if (!classBody) return false;
  // Look for `<TypeName> [*&]? <name>;` where TypeName is a capitalized identifier ≠ self.
  const re = /\b([A-Z]\w*)\s*[*&]?\s*\w+\s*;/g;
  let m;
  while ((m = re.exec(classBody))) {
    if (m[1] !== className && !['std', 'string', 'String'].includes(m[1])) return true;
  }
  return false;
}

function ruleOwningMember(rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  const ptrs = (rule.smart_ptr || ['unique_ptr', 'shared_ptr']).map(escapeRegex).join('|');
  return new RegExp(`\\b(?:std::)?(?:${ptrs})\\s*<`).test(classBody);
}

function ruleOwningMemberOfType(rule, ctx, typeKey) {
  const { classBody } = ctx;
  if (!classBody) return false;
  const ptrs = (rule.smart_ptr || ['unique_ptr', 'shared_ptr']).map(escapeRegex).join('|');
  let typeName = '';
  if (typeKey === 'self') typeName = ctx.className;
  else if (typeKey === 'base') {
    const inh = extractInheritanceClause(ctx.sourceText, ctx.className);
    const m = /:\s*(?:public|protected|private)?\s*([A-Za-z_]\w*)/.exec(inh);
    typeName = m ? m[1] : '';
  }
  if (!typeName) return false;
  return new RegExp(`\\b(?:std::)?(?:${ptrs})\\s*<\\s*${escapeRegex(typeName)}\\b`).test(classBody);
}

function ruleSelfReferenceReturn(_rule, ctx) {
  const { classBody, className } = ctx;
  if (!classBody) return false;
  return new RegExp(`\\b${escapeRegex(className)}\\s*[*&]\\s+\\w+\\s*\\(`).test(classBody);
}

function ruleStlCall(rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  const callee = String(rule.callee || '').replace(/^std::/, '');
  if (!callee) return false;
  let typeArg = String(rule.type_arg || '').replace(/\{class_name\}/g, ctx.className);
  const reSrc = typeArg
    ? `\\b(?:std::)?${escapeRegex(callee)}\\s*<\\s*${escapeRegex(typeArg)}\\b`
    : `\\b(?:std::)?${escapeRegex(callee)}\\s*<`;
  return new RegExp(reSrc).test(classBody);
}

function ruleTokenPattern(rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  const tokens = rule.tokens || [];
  if (!tokens.length) return false;
  // Sequence search with up-to-30-char gaps between tokens; underscore is a wildcard token.
  let pattern = tokens.map(t => t === '...' ? '[\\s\\S]{0,80}' : t === '_' ? '\\w+' : escapeRegex(t)).join('\\s*');
  return new RegExp(pattern).test(classBody);
}

function ruleMethodForwardsToMember(_rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  // Look for `<member_name>->method(` or `<member_name>.method(` inside any method body.
  return /\b\w+_?\s*->\s*\w+\s*\(/.test(classBody) || /\bm_\w+\s*\.\s*\w+\s*\(/.test(classBody);
}

function ruleNullCheckThenConstructMember(_rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  return /\bif\s*\(\s*!?\s*\w+_?\s*\)[\s\S]{0,200}(?:new|make_unique|make_shared)\b/.test(classBody);
}

function ruleControlFlowThenConstruction(_rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  return /\b(if|switch)\b[\s\S]{0,400}\b(?:new|make_unique|make_shared)\b/.test(classBody);
}

function ruleReturnTypeSmartPtr(_rule, ctx) {
  const { classBody } = ctx;
  if (!classBody) return false;
  return /\b(unique_ptr|shared_ptr)\s*<[^>]+>\s+\w+\s*\(/.test(classBody);
}

function ruleTerminatorMethodWithDistinctReturn(_rule, ctx) {
  const { classBody, className } = ctx;
  if (!classBody) return false;
  // Any method whose return type isn't the class itself or a reference to it.
  const re = /^\s*([\w:<>]+\s*\*?)\s+\w+\s*\([^)]*\)\s*\{/gm;
  let m;
  while ((m = re.exec(classBody))) {
    const ret = m[1].trim();
    if (ret === className || ret === `${className}&` || ret === `${className}*`) continue;
    if (/^(static|virtual|inline|public|private|protected)$/.test(ret)) continue;
    return true;
  }
  return false;
}

function ruleFriendClass(_rule, ctx) {
  const { classBody } = ctx;
  return classBody ? /\bfriend\s+class\s+\w+/.test(classBody) : false;
}

function ruleInheritsFromMemberType(_rule, ctx) {
  const { sourceText, className, classBody } = ctx;
  if (!classBody) return false;
  const inh = extractInheritanceClause(sourceText, className);
  const baseMatch = /:\s*(?:public|protected|private)?\s*([A-Za-z_]\w*)/.exec(inh);
  if (!baseMatch) return false;
  const baseName = baseMatch[1];
  return new RegExp(`\\b${escapeRegex(baseName)}\\s*[*&]?\\s+\\w+\\s*[;=]`).test(classBody);
}

const RULE_HANDLERS = {
  deleted_method:                          ruleDeletedMethod,
  defaulted_method:                        ruleDefaultedMethod,
  static_local:                            ruleStaticLocal,
  static_member:                           ruleStaticMember,
  pure_virtual_count:                      rulePureVirtualCount,
  non_static_data_member_count:            ruleNonStaticDataMemberCount,
  override_specifier_count:                ruleOverrideSpecifierCount,
  final_specifier_on_class:                ruleFinalOnClass,
  inheritance_present:                     ruleInheritancePresent,
  inherits_from_member_type:               ruleInheritsFromMemberType,
  non_self_class_member:                   ruleNonSelfClassMember,
  owning_member:                           ruleOwningMember,
  owning_member_of_self_type:              (r, c) => ruleOwningMemberOfType(r, c, 'self'),
  owning_member_of_base_type:              (r, c) => ruleOwningMemberOfType(r, c, 'base'),
  self_reference_return:                   ruleSelfReferenceReturn,
  stl_call:                                ruleStlCall,
  token_pattern:                           ruleTokenPattern,
  method_forwards_to_member:               ruleMethodForwardsToMember,
  null_check_then_construct_member:        ruleNullCheckThenConstructMember,
  control_flow_then_construction:          ruleControlFlowThenConstruction,
  return_type_smart_ptr:                   ruleReturnTypeSmartPtr,
  terminator_method_with_distinct_return:  ruleTerminatorMethodWithDistinctReturn,
  friend_class:                            ruleFriendClass
};

/** Apply a count-rule's min/max bounds, returning boolean. */
function checkBound(rule, value) {
  const isCount = typeof value === 'number';
  if (!isCount) return Boolean(value);
  if (rule.min !== undefined && value < rule.min) return false;
  if (rule.max !== undefined && value > rule.max) return false;
  if (rule.min === undefined && rule.max === undefined) return value > 0;
  return true;
}

/**
 * Evaluate every evidence_rule for one detected pattern.
 * Returns { fired: string[], missed: string[], implementationFit: 0..1 }.
 */
function evaluatePattern(detectedPattern, catalogEntry, sourceText) {
  const evidence = (catalogEntry && catalogEntry.evidence_rules) || [];
  if (!evidence.length) {
    return { fired: [], missed: [], implementationFit: 0, hasEvidenceRules: false };
  }
  const className = detectedPattern.className || '';
  const classBody = (detectedPattern.classText && detectedPattern.classText.length > 0)
    ? detectedPattern.classText
    : extractClassBody(sourceText, className);
  const ctx = { sourceText, className, classBody };

  const fired = [];
  const missed = [];
  let positiveTotal = 0, positiveFired = 0, negativeTotal = 0, negativeFired = 0;

  for (const rule of evidence) {
    const handler = RULE_HANDLERS[rule.kind];
    if (!handler) {
      missed.push(`${rule.id} [unknown_kind:${rule.kind}]`);
      continue;
    }
    const raw = handler(rule, ctx);
    const passed = checkBound(rule, raw);

    if (rule.polarity === 'positive') {
      positiveTotal += 1;
      if (passed) { positiveFired += 1; fired.push(rule.id); }
      else missed.push(rule.id);
    } else {
      // Negative polarity: rule "fires" (good) when its condition is FALSE.
      negativeTotal += 1;
      if (!passed) { negativeFired += 1; fired.push(rule.id); }
      else missed.push(rule.id);
    }
  }

  const positiveScore = positiveTotal === 0 ? 0 : positiveFired / positiveTotal;
  const negativeScore = negativeTotal === 0 ? 0 : negativeFired / negativeTotal;
  // Weight: positives count fully, negatives count half (they're tie-breakers, not signal).
  const total = positiveTotal + negativeTotal * 0.5;
  const earned = positiveFired + negativeFired * 0.5;
  const implementationFit = total === 0 ? 0 : Math.max(0, Math.min(1, earned / total));

  return { fired, missed, implementationFit, hasEvidenceRules: true };
}

module.exports = { evaluatePattern, extractClassBody };
