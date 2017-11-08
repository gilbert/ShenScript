'use strict';

class Scope {
    static fromHead() {
        return new Scope().inHead();
    }
    static fromTail() {
        const scope = new Scope();
        scope.position = 'tail';
        return scope;
    }
    constructor() {
        this.locals = [];
        this.scopeName = null;
        this.position = 'head';
    }
    clone() {
        const scope = new Scope();
        scope.locals = this.locals.slice(0);
        scope.scopeName = this.scopeName;
        scope.position = this.position;
        return scope;
    }
    isLocal(name) {
        if (isSymbol(name)) name = name.name;
        return this.locals.includes(name);
    }
    let(name) {
        if (isSymbol(name)) name = name.name;
        const scope = this.clone();
        scope.locals.push(name);
        return scope;
    }
    lambda(param) {
        if (isSymbol(param)) param = param.name;
        const scope = this.clone();
        scope.locals.push(param);
        scope.position = 'tail';
        return scope;
    }
    freeze() {
        const scope = this.clone();
        scope.position = 'tail';
        return scope;
    }
    defun(name, params) {
        if (isSymbol(name)) name = name.name;
        const scope = this.clone();
        scope.locals = params.slice(0);
        scope.scopeName = name;
        scope.position = 'tail';
        return scope;
    }
    inHead() {
        const scope = this.clone();
        scope.position = 'head';
        return scope;
    }
    invoke(f, args) {
        return `${this.position === 'head' ? 'Kl.headCall' : 'Kl.tailCall'}(${f}, [${args}])`;
    }
}

class Transpiler {
    static translateHead(expr) {
        return new Transpiler().translate(expr, Scope.fromHead());
    }
    static translateTail(expr) {
        return new Transpiler().translate(expr, Scope.fromTail());
    }
    contructor(scope) {
        this.scope = scope;
    }
    static rename(name) {
        if (isSymbol(name)) name = name.name;
        let result = "";
        for (let i = 0; i < name.length; ++i) {
            switch (name[i]) {
                case '-': { result += '_'; break; }
                case '_': { result += '$un'; break; }
                case '$': { result += '$dl'; break; }
                case '.': { result += '$do'; break; }
                case ',': { result += '$cm'; break; }
                case '`': { result += '$bt'; break; }
                case '+': { result += '$pl'; break; }
                case '*': { result += '$st'; break; }
                case '<': { result += '$lt'; break; }
                case '>': { result += '$gt'; break; }
                case '%': { result += '$pe'; break; }
                case '&': { result += '$am'; break; }
                case '^': { result += '$ca'; break; }
                case '=': { result += '$eq'; break; }
                case '!': { result += '$ex'; break; }
                case '?': { result += '$qu'; break; }
                case '@': { result += '$at'; break; }
                case '~': { result += '$ti'; break; }
                case '#': { result += '$ha'; break; }
                case '|': { result += '$pi'; break; }
                case ':': { result += '$co'; break; }
                case ';': { result += '$sc'; break; }
                case '/': { result += '$sl'; break; }
                case '{': { result += '$lc'; break; }
                case '}': { result += '$rc'; break; }
                case '[': { result += '$ls'; break; }
                case ']': { result += '$rs'; break; }
                case '\\': { result += '$bs'; break; }
                default:  { result += name[i]; break; }
            }
        }
        return result;
    }
    static isForm(expr, keyword, length) {
        return isCons(expr) && (!length || consLength(expr) === length) && isSymbol(expr.hd) && expr.hd.name === keyword;
    }
    static ifExpr(c, x, y) {
        return `asJsBool(${c})?(${x}):(${y})`;
    }
    conditionExpr(expr, scope) {
        return `asJsBool(${this.translate(expr, scope.inHead())})`;
    }
    renderLet(bindings, body) {
        if (isCons(bindings)) {
            body = `const ${Transpiler.rename(bindings.hd.sym)} = ${bindings.hd.value};
                    ${body}`;
            if (bindings.hd.redefinition) {
                body = `{
                  ${body}
                }`;
            }
            return this.renderLet(bindings.tl, body);
        }
        return `(function () {
                  ${body}
                })()`;
    }
    translateLet(bindings, expr, scope) {
        if (Transpiler.isForm(expr, 'let', 4)) {
            const [_let, local, value, body] = consToArray(expr);
            const binding = {
                sym: local,
                value: this.translate(value, scope),
                redefinition: consToArray(bindings).some(x => x.sym.name === local.name)
            };
            return this.translateLet(new Cons(binding, bindings), body, scope.let(local));
        }
        return this.renderLet(bindings, `return ${this.translate(expr, scope)};`);
    }

    // TODO: track expression types to simplify code

    // TODO: use fn.length to do partial application/overapplication

    // TODO: convert Statements -> Expressionscope with
    //       `function(){ ${butLastStmts.join(';')}; return ${lastStmt}; }()`

    // TODO: convert Expression -> Statementscope with
    //       `(${expr});`

    // function convertType(typedExpr, targetType) {
    //     if (typedExpr.type === 'js.bool' && targetType === 'kl.bool') return {expr: `asKlBool(${typedExpr})`, type: targetType};
    //     if (typedExpr.type === 'kl.bool' && targetType === 'js.bool') return {expr: `asJsBool(${typedExpr})`, type: targetType};
    //     return expr;
    // }

    // Value{Num, Str, Sym, Cons} -> JsString
    translate(code, scope) {
        if (isArray(code) || isFunction(code) || isError(code) || isStream(code)) {
            err('vectors, functions, errors and streams are not valid syntax');
        }

        if (!scope) scope = this.scope;

        // Literals
        if (code === null) return 'null';
        if (isNumber(code)) return `${code}`;
        if (isString(code)) return `"${code}"`;

        // Local variables and idle symbols
        if (isSymbol(code)) return scope.isLocal(code) ? Transpiler.rename(code) : `new Sym("${code}")`;

        // Conjunction and disjunction
        if (Transpiler.isForm(code, 'and', 3)) {
            const [_and, left, right] = consToArray(code);
            return `asKlBool(asJsBool(${this.translate(left, scope.inHead())}) && asJsBool(${this.translate(right, scope.inHead())}))`;
        }
        if (Transpiler.isForm(code, 'or', 3)) {
            const [_or, left, right] = consToArray(code);
            return `asKlBool(asJsBool(${this.translate(left, scope.inHead())}) || asJsBool(${this.translate(right, scope.inHead())}))`;
        }

        // Conditional evaluation
        if (Transpiler.isForm(code, 'if', 4)) {
            const [_if, condition, consequent, alternative] = consToArray(code);
            return Transpiler.ifExpr(
                this.translate(condition, scope.inHead()),
                this.translate(consequent, scope),
                this.translate(alternative, scope));
        }
        if (Transpiler.isForm(code, 'cond')) {
            function condRecur(code) {
                if (code === null) {
                    return `kl.fns.${Transpiler.rename('simple-error')}("No clause was true")`;
                } else {
                    const [condition, consequent] = consToArray(code.hd);
                    return Transpiler.ifExpr(
                        this.translate(condition, scope.inHead()),
                        this.translate(consequent, scope),
                        condRecur(code.tl));
                }
            }
            return condRecur(code.tl);
        }

        // Local variable binding
        if (Transpiler.isForm(code, 'let', 4)) {
            return this.translateLet(null, code, scope);
        }

        // Global function definition
        if (Transpiler.isForm(code, 'defun', 4)) {
            const [_defun, name, params, body] = consToArray(code);
            const paramNames = consToArray(params).map(expr => expr.name);
            return `kl.defun('${name}', ${paramNames.length}, function (${paramNames.map(Transpiler.rename).join()}) {
                      return ${this.translate(body, scope.defun(name, paramNames))};
                    })`;
        }

        // 1-arg anonymous function
        if (Transpiler.isForm(code, 'lambda', 3)) {
            const [_lambda, param, body] = consToArray(code);
            return `Kl.setArity(1, function (${Transpiler.rename(param)}) {
                      return ${this.translate(body, scope.lambda(param))};
                    })`;
        }

        // 0-arg anonymous function
        if (Transpiler.isForm(code, 'freeze', 2)) {
            const [_freeze, body] = consToArray(code);
            return `Kl.setArity(0, function () {
                      return ${this.translate(body, scope.freeze())};
                    })`;
        }

        // Error handling
        if (Transpiler.isForm(code, 'trap-error', 3)) {
            const [_trapError, body, handler] = consToArray(code);
            return `(function () {
                      try {
                        return ${this.translate(body, scope)};
                      } catch ($err) {
                        return ${this.translate(handler, scope)}($err);
                      }
                    })()`;
        }

        // Flattened, sequential, side-effecting expressions
        if (Transpiler.isForm(code, 'do')) {
            const flattenDo = expr => Transpiler.isForm(expr, 'do') ? concatAll(consToArray(expr.tl).map(flattenDo)) : [expr];
            const [voids, last] = butLast(flattenDo(code).map(expr => this.translate(expr, scope)));
            return `(function () {
                      ${voids.join(';\n')};
                      return ${last};
                    })()`;
        }

        // Inlined global symbol assign
        if (Transpiler.isForm(code, 'set', 3)) {
            const [_set, sym, value] = consToArray(code);
            if (!scope.isLocal(sym)) {
                return `kl.symbols.${Transpiler.rename(sym)} = ${this.translate(value, scope.inHead())}`;
            }
        }

        // Inlined global symbol retrieve
        if (Transpiler.isForm(code, 'value', 2)) {
            const [_value, sym] = consToArray(code);
            if (!scope.isLocal(sym) && kl.isSymbolDefined(sym)) {
                return `kl.symbols.${Transpiler.rename(sym)}`;
            }
        }

        const [fexpr, ...argExprs] = consToArray(code);
        const translatedArgs = argExprs.map(expr => this.translate(expr, scope.inHead())).join();

        if (isSymbol(fexpr)) {

            // JS-injection form
            if (fexpr.name === 'js.') {
                if (consLength(code) === 1) return 'null';
                const [voids, last] = butLast(consToArray(code.tl));
                return `(function () {
                          ${voids.join(';\n')};
                          return asKlValue(${last});
                        })()`;
            }

            // JS-namespace function call
            if (fexpr.name.indexOf('js.') === 0) {
                return `${fexpr.name.slice(3)}(${translatedArgs})`;
            }

            // KL function call
            const name = Transpiler.rename(fexpr);
            if (scope.isLocal(fexpr)) {
                return scope.invoke(name, translatedArgs);
            } else {
                return scope.invoke(`kl.fns.${name}`, translatedArgs);
            }
        }

        // Application of function value
        return scope.invoke(`asKlFunction(${this.translate(fexpr, scope.inHead())})`, translatedArgs);
    }
}