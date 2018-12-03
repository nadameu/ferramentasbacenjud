"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
async function main() {
    const preferencias = await carregarPreferencias();
    await whenDocumentInteractive();
    analisarPagina(preferencias);
}
class Maybe {
    constructor(fold) {
        this.fold = fold;
    }
    ap(that) {
        return that.chain(f => this.map(f));
    }
    chain(f) {
        return this.fold(() => Nothing, f);
    }
    filter(p) {
        return this.fold(() => Nothing, x => (p(x) ? Just(x) : Nothing));
    }
    ifJust(f) {
        this.fold(() => { }, f);
    }
    ifNothing(f) {
        this.fold(f, () => { });
    }
    isJust() {
        return this.fold(() => false, () => true);
    }
    isNothing() {
        return this.fold(() => true, () => false);
    }
    map(f) {
        return this.chain(x => Just(f(x)));
    }
    mapNullable(f) {
        return this.chain(x => Maybe.fromNullable(f(x)));
    }
    getOrElse(defaultValue) {
        return this.fold(() => defaultValue, x => x);
    }
    static fromNullable(value) {
        return value == null ? Nothing : Just(value);
    }
    static of(value) {
        return new Maybe((_, J) => J(value));
    }
    static zero() {
        return new Maybe((N, _) => N());
    }
}
function Just(value) {
    return Maybe.of(value);
}
const Nothing = Maybe.zero();
class Task {
    constructor(_fork) {
        this._fork = _fork;
    }
    alt(that) {
        return new Task((rej, res) => {
            let done = false;
            let cancelThat = () => { };
            const cancelThis = this.fork(guard((e) => {
                cancelThat();
                rej(e);
            }), guard((x) => {
                cancelThat();
                res(x);
            }));
            if (done)
                return;
            cancelThat = that.fork(guard((e) => {
                cancelThis();
                rej(e);
            }), guard((x) => {
                cancelThis();
                res(x);
            }));
            return guard(() => {
                cancelThis();
                cancelThat();
            });
            function guard(f) {
                return x => {
                    if (done)
                        return;
                    done = true;
                    f(x);
                };
            }
        });
    }
    chain(f) {
        return new Task((rej, res) => {
            let cancelInner = () => { };
            const cancel = this.fork(rej, x => {
                cancelInner = f(x).fork(rej, res);
            });
            return () => {
                cancelInner();
                cancel();
            };
        });
    }
    chainLeft(f) {
        return new Task((rej, res) => {
            let cancelInner = () => { };
            const cancel = this.fork(e => {
                cancelInner = f(e).fork(rej, res);
            }, res);
            return () => {
                cancelInner();
                cancel();
            };
        });
    }
    fork(whenRejected, whenResolved) {
        let done = false;
        const cancel = this._fork(guard(whenRejected), guard(whenResolved)) || (() => { });
        return guard(cancel);
        function guard(f) {
            return (x) => {
                if (done)
                    return;
                done = true;
                f(x);
            };
        }
    }
    map(f) {
        return new Task((rej, res) => this.fork(rej, (x) => res(f(x))));
    }
    static of(value) {
        return new Task((_, res) => res(value));
    }
    static rejected(reason) {
        return new Task(rej => rej(reason));
    }
}
class Validation {
    constructor(fold) {
        this.fold = fold;
    }
    ap(that) {
        return that.fold(thoseErrors => Failure(this.fold(theseErrors => thoseErrors.concat(theseErrors), () => thoseErrors)), f => this.map(f));
    }
    chain(f) {
        return this.fold(Failure, f);
    }
    map(f) {
        return this.fold(Failure, x => Success(f(x)));
    }
    toMaybe() {
        return new Maybe((Nothing, Just) => this.fold(Nothing, Just));
    }
    toTask() {
        return new Task((rej, res) => this.fold(rej, res));
    }
    static fail(error) {
        return Failure([error]);
    }
    static of(value) {
        return Success(value);
    }
}
function Failure(errors) {
    return new Validation((F, _) => F(errors));
}
function Success(value) {
    return new Validation((_, S) => S(value));
}
// Funções
function adicionarCheckboxLembrar(preferencias) {
    const template = document.createElement('template');
    template.innerHTML = `<label> <input type="checkbox"> Lembrar</label><br>`;
    return function (input, preferencia) {
        const fragment = document.importNode(template.content, true);
        const checkbox = fragment.querySelector('input');
        checkbox.checked = preferencias.get(preferencia).isJust();
        checkbox.addEventListener('change', salvarPreferencia);
        input.addEventListener('change', salvarPreferencia);
        let next = input.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE && (next.textContent || '').match(/^\s*$/)) {
            const empty = next;
            next = next.nextSibling;
            empty.parentNode.removeChild(empty);
        }
        input.parentNode.insertBefore(fragment, input.nextSibling);
        return salvarPreferencia;
        function salvarPreferencia() {
            (checkbox.checked && input.value
                ? preferencias.set(preferencia, input.value)
                : preferencias.remove(preferencia)).catch(error => {
                console.error(error);
            });
        }
    };
}
function analisarPagina(preferencias) {
    const url = new URL(location.href);
    const pagina = url.pathname.split('/bacenjud2/')[1].split('.')[0];
    const acao = Paginas.get(pagina);
    if (acao) {
        try {
            const result = acao(preferencias, pagina);
            result.fold(errors => {
                console.log('Erro(s) encontrado(s):', errors);
            }, () => { });
        }
        catch (error) {
            console.error(error);
        }
    }
    else {
        console.log('Página desconhecida:', pagina);
    }
}
async function carregarPreferencias() {
    const preferencias = new Map(await browser.storage.local
        .get()
        .then(prefs => Object.entries(prefs)));
    const listeners = new Map();
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local')
            return;
        const changedKeys = Object.keys(changes);
        changedKeys.forEach(key => {
            const result = changes[key];
            if ('newValue' in result && typeof result.newValue === 'string') {
                preferencias.set(key, result.newValue);
            }
            else {
                preferencias.delete(key);
            }
            (listeners.get(key) || []).forEach(listener => listener(Maybe.fromNullable(preferencias.get(key))));
        });
    });
    return {
        get(name) {
            return Maybe.fromNullable(preferencias.get(name));
        },
        set(name, value) {
            return browser.storage.local.set({ [name]: value });
        },
        remove(name) {
            return browser.storage.local.remove(name);
        },
    };
}
function conferirDadosMinutaInclusao(preferencias) {
    if (queryAll('.msgErro').length > 0) {
        return criarMinutaInclusao(preferencias);
    }
    return query('form')
        .chain(form => sequenceAO(Validation, {
        senhaJuiz: queryInput('senhaJuiz', form),
        btnIncluir: queryInput('btnIncluir', form),
    }))
        .map(({ senhaJuiz, btnIncluir }) => {
        if (!senhaJuiz.disabled) {
            senhaJuiz.focus();
        }
        else {
            window.addEventListener('keypress', e => {
                if (e.keyCode !== 13 /* ENTER */)
                    return;
                e.preventDefault();
                btnIncluir.click();
            });
        }
    });
}
function consultarPessoa(_) {
    window.addEventListener('keyup', evt => {
        if (evt.keyCode === 27 /* ESCAPE */) {
            opener.focus();
            window.close();
        }
    });
    window.addEventListener('unload', () => {
        opener.postMessage({ acao: 'incluirReu' }, location.origin);
    });
    return Success(undefined);
}
function consultarPorAssessor(preferencias) {
    return query('form')
        .chain(form => sequenceAO(Validation, {
        juiz: queryInput('cdOperadorJuiz', form),
        assessor: queryInput('cdOperadorAssessor', form),
        dataInicial: queryInput('dataInicial', form),
        dataFinal: queryInput('dataFinal', form),
    }))
        .map(({ juiz, assessor, dataInicial, dataFinal }) => {
        [dataInicial, dataFinal].forEach(input => {
            input.required = true;
        });
        const preencherSeVazio = preencherSeVazioFactory(preferencias);
        preencherSeVazio(juiz, "juiz" /* JUIZ */);
        preencherSeVazio(assessor, "assessor" /* ASSESSOR */);
        const adicionar = adicionarCheckboxLembrar(preferencias);
        adicionar(juiz, "juiz" /* JUIZ */);
        adicionar(assessor, "assessor" /* ASSESSOR */);
        focarSeVazio([juiz, assessor, dataInicial, dataFinal]);
    });
}
function consultarPorJuizo(preferencias) {
    return query('form')
        .chain(form => sequenceAO(Validation, {
        idVara: querySelect('idVara', form),
        vara: queryInput('codigoVara', form),
        juiz: queryInput('operador', form),
        dataInicial: queryInput('dataInicial', form),
        dataFinal: queryInput('dataFinal', form),
        bloqueios: queryInput('idBloqueiosPendentes', form),
    }))
        .map(({ idVara, vara, juiz, dataInicial, dataFinal, bloqueios }) => {
        vara.required = true;
        bloqueios.addEventListener('change', sincronizarBloqueioDatas);
        sincronizarBloqueioDatas();
        const preencherSeVazio = preencherSeVazioFactory(preferencias);
        preencherSeVazio(vara, "vara" /* VARA */);
        preencherSeVazio(juiz, "juiz" /* JUIZ */);
        const adicionar = adicionarCheckboxLembrar(preferencias);
        const salvarVara = adicionar(vara, "vara" /* VARA */);
        adicionar(juiz, "juiz" /* JUIZ */);
        const sincronizar = () => sincronizarSelectInput(idVara, vara, salvarVara);
        idVara.addEventListener('change', sincronizar);
        sincronizar();
        focarSeVazio([vara, juiz]);
        function sincronizarBloqueioDatas() {
            const obrigatorioPreencherDatas = !bloqueios.checked;
            [dataInicial, dataFinal].forEach(input => {
                input.required = obrigatorioPreencherDatas;
            });
        }
    });
}
function consultarPorProcesso(_) {
    return query('form')
        .chain(form => queryInput('numeroProcesso', form))
        .map(input => {
        input.required = true;
        input.pattern = '[0-9]{10}|[0-9]{15}|[0-9]{20}';
        input.title = 'Digite o número do processo com 10, 15 ou 20 dígitos';
        input.addEventListener('input', () => {
            input.value = input.value.trim().replace(/\D/g, '');
        });
        input.select();
        input.focus();
    });
}
function consultarPorProtocolo(_) {
    return query('form')
        .chain(form => queryInput('numeroProtocolo', form))
        .map(input => {
        input.required = true;
        input.pattern = '[0-9]{14}';
        input.title = 'Digite o número do protocolo (14 dígitos)';
        input.addEventListener('input', () => {
            input.value = input.value.trim().replace(/\D/g, '');
        });
        input.select();
        input.focus();
    });
}
function criarMinutaInclusao(preferencias) {
    return query('form')
        .chain(form => sequenceAO(Validation, {
        form: Success(form),
        juiz: queryInput('cdOperadorJuiz', form),
        idVara: querySelect('idVara', form),
        vara: queryInput('codigoVara', form),
        processo: queryInput('processo', form),
        tipo: querySelect('idTipoAcao', form),
        nomeAutor: queryInput('nomeAutor', form),
        docAutor: queryInput('cpfCnpjAutor', form),
        docReu: query('input#cpfCnpj'),
        reus: querySelect('reus', form),
        maybeValor: Success(queryInput('valorUnico', form).toMaybe()),
    }))
        .map(elementos => {
        const { form, juiz, idVara, vara, processo, tipo, nomeAutor, docAutor, docReu, reus, maybeValor, } = elementos;
        [juiz, vara, processo, tipo, nomeAutor]
            .concat(maybeValor.fold(() => [], x => [x]))
            .forEach(campo => {
            campo.required = true;
        });
        const adicionar = adicionarCheckboxLembrar(preferencias);
        if (juiz.type !== 'hidden') {
            adicionar(juiz, "juiz" /* JUIZ */);
        }
        const salvarVara = adicionar(vara, "vara" /* VARA */);
        const sincronizar = () => sincronizarSelectInput(idVara, vara, salvarVara);
        idVara.addEventListener('change', sincronizar);
        sincronizar();
        const preencherSeVazio = preencherSeVazioFactory(preferencias);
        preencherSeVazio(juiz, "juiz" /* JUIZ */);
        preencherSeVazio(vara, "vara" /* VARA */);
        const { linha: trOrigem, select: origem } = criarLinhaSelect('Origem', 'Selecione a origem do processo', { TRF: 'TRF4', PR: 'JFPR', RS: 'JFRS', SC: 'JFSC' }, "origem" /* ORIGEM */);
        const { linha: trInverter, select: inverter } = criarLinhaSelect('Inverter autor/réu', 'Informe se o exequente se encontra no polo passivo do processo', { S: 'Sim', N: 'Não' }, "inverter" /* INVERTER */);
        const trProcesso = Maybe.fromNullable(processo.closest('tr'));
        trProcesso.ifJust(tr => {
            const parent = tr.parentNode;
            parent.insertBefore(trOrigem, tr);
            parent.insertBefore(trInverter, tr);
        });
        const substituir = new Map([['d', '[0-9]'], ['.', '\\.?'], ['-', '-?']]);
        processo.pattern = ['dd.dd.ddddd-d', 'dddd.dd.dd.dddddd-d', 'ddddddd-dd.dddd.d.dd.dddd']
            .map(pattern => pattern.replace(/d{2,}/g, req => `d{${req.length}}`))
            .map(pattern => pattern.replace(/./g, x => substituir.get(x) || x))
            .join('|');
        processo.title =
            'Digite o número do processo com 10, 15 ou 20 dígitos (pontos e traços opcionais)';
        focarSeVazio([juiz, vara, origem, inverter, processo]);
        const template = document.createElement('template');
        template.innerHTML = `<div id="blocking" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; padding: 10%; background: rgba(0, 0, 0, 75%); display: none; font-size: 4em; color: white; text-align: center; align-items: center; cursor: default;">Aguarde, buscando dados do processo...</div>`;
        const blocking = document.importNode(template.content, true).firstChild;
        document.body.appendChild(blocking);
        const templateBotaoBuscar = document.createElement('template');
        templateBotaoBuscar.innerHTML = `&nbsp;<input type="button" class="botao" value="Buscar dados do processo">`;
        const fragBuscar = document.importNode(templateBotaoBuscar.content, true);
        const botaoBuscar = fragBuscar.querySelector('input');
        botaoBuscar.addEventListener('click', buscarDados);
        processo.parentNode.insertBefore(fragBuscar, processo.nextSibling);
        let buscando = false;
        let tentativaBuscarDados = false;
        processo.addEventListener('change', buscarDados);
        form.addEventListener('submit', evt => {
            if (buscando) {
                evt.preventDefault();
            }
        });
        function buscarDados() {
            if (buscando)
                return;
            if ([origem, inverter, processo].find(input => !input.validity.valid)) {
                tentativaBuscarDados = true;
                form.reportValidity();
                return;
            }
            tentativaBuscarDados = false;
            buscando = true;
            blocking.style.display = 'grid';
            const inverterPolos = inverter.value === 'S';
            preencherDados({ numproc: processo.value, codClasse: '', valCausa: Nothing, autores: [], reus: [] }, inverterPolos);
            const TIMEOUT = 10000; // milissegundos
            obterDadosProcesso(processo.value, origem.value)
                .alt(new Task(rej => {
                const timer = setTimeout(() => rej(['Conexão demorou demais para responder.']), TIMEOUT);
                return () => clearTimeout(timer);
            }))
                .map((_a) => {
                var { numproc } = _a, info = __rest(_a, ["numproc"]);
                preencherDados(Object.assign({ numproc: numproc.replace(/\D/g, '') }, info), inverterPolos);
            })
                .chainLeft(errors => {
                alert(errors.join('\n'));
                return Task.of(undefined);
            })
                .map(() => {
                buscando = false;
                blocking.style.display = 'none';
                const algumFocado = focarSeVazio([juiz, vara, tipo, nomeAutor, docAutor]);
                maybeValor.ifJust(input => {
                    if (!algumFocado) {
                        input.select();
                        input.focus();
                    }
                });
            })
                .fork(() => { }, () => { });
        }
        function criarLinhaSelect(label, title, options, preferencia) {
            const template = document.createElement('template');
            template.innerHTML = `<tr class="fundoPadraoAClaro2">
	<td class="nomeCampo">* ${label}:</td>
	<td>
		<select title="${title}" required><option value=""></option>${Object.keys(options).map(key => `<option value="${key}">${options[key]}</option>`)}</select>
	</td>
</tr>`;
            const linha = document.importNode(template.content, true);
            const select = linha.querySelector('select');
            select.value = preferencias.get(preferencia).getOrElse('');
            select.addEventListener('change', () => {
                Maybe.of(select.value)
                    .filter(x => x !== '')
                    .fold(() => preferencias.remove(preferencia), value => {
                    if (tentativaBuscarDados) {
                        buscarDados();
                    }
                    return preferencias.set(preferencia, value);
                })
                    .catch(error => console.error(error));
            });
            return { linha, select };
        }
        function preencherDados(dados, inverter) {
            processo.value = dados.numproc;
            const tipoAcaoPorCodClasse = new Map([
                ['000098', '1'],
                ['000099', '4'],
                ['000169', '1'],
                ['000229', '1'],
            ]);
            tipo.value = Maybe.fromNullable(tipoAcaoPorCodClasse.get(dados.codClasse)).getOrElse('');
            const infoAutores = inverter ? dados.reus : dados.autores;
            const infoAutor = Maybe.fromNullable(infoAutores[0]).getOrElse({
                nome: '',
                documento: Nothing,
            });
            nomeAutor.value = infoAutor.nome;
            docAutor.value = infoAutor.documento.getOrElse('');
            maybeValor.ifJust(input => {
                input.value = dados.valCausa
                    .map(val => val.toLocaleString('pt-BR', {
                    style: 'decimal',
                    minimumIntegerDigits: 1,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: true,
                }))
                    .getOrElse('');
            });
            if (reus.options.length > 0) {
                Array.from(reus.options).forEach(option => {
                    option.selected = true;
                });
                if (reus.title.match(/réu/)) {
                    window.wrappedJSObject.excluirReu();
                }
                else {
                    window.wrappedJSObject.excluirPessoa();
                }
            }
            const infoReus = inverter ? dados.autores : dados.reus;
            const docsReus = infoReus.reduce((xs, { documento: mx }) => mx.fold(() => xs, x => (xs.push(x), xs)), []);
            if (docsReus.length > 0) {
                window.addEventListener('message', onMessage);
                incluirReu();
            }
            function incluirReu() {
                if (docsReus.length === 0) {
                    window.removeEventListener('message', onMessage);
                    return;
                }
                const reu = docsReus.shift();
                docReu.value = reu;
                window.wrappedJSObject.abreConsultarCpfCnpjPopUp();
            }
            function onMessage(evt) {
                if (evt.origin !== location.origin)
                    return;
                if ('acao' in evt.data && evt.data.acao === 'incluirReu') {
                    incluirReu();
                }
            }
        }
    });
}
function dologin(preferencias) {
    return query('form')
        .chain(form => sequenceAO(Validation, {
        form: Success(form),
        opcoesLogin: queryRadio('opcao_login', form),
        unidade: queryInput('unidade', form),
        operador: queryInput('operador', form),
        senha: queryInput('senha', form),
        cpf: queryInput('cpf', form),
    }))
        .map(elementos => {
        const { form, opcoesLogin, unidade, operador, senha, cpf } = elementos;
        const exigirCampos = exigirCamposFactory([unidade, operador, senha, cpf].concat(queryAll('input[name="senhanova"], input[name="senhanova2"]', form)));
        exigirCampos(true);
        queryMaybe('input[name="cancelar_troca"]').ifJust(botao => {
            botao.addEventListener('click', () => exigirCampos(false));
        });
        const adicionar = adicionarCheckboxLembrar(preferencias);
        adicionar(unidade, "unidade" /* UNIDADE */);
        adicionar(operador, "operador" /* OPERADOR */);
        opcoesLogin.forEach(opcao => {
            opcao.addEventListener('click', verificarFoco);
        });
        window.addEventListener('load', verificarFoco);
        if (document.readyState === 'complete')
            verificarFoco();
        const preencherSeVazio = preencherSeVazioFactory(preferencias);
        function preencher() {
            preencherSeVazio(unidade, "unidade" /* UNIDADE */);
            preencherSeVazio(operador, "operador" /* OPERADOR */);
            focarSeVazio([unidade, operador, cpf, senha]);
        }
        function verificarFoco() {
            const isOperador = opcoesLogin.value === 'operador';
            unidade.disabled = !isOperador;
            operador.disabled = !isOperador;
            cpf.disabled = isOperador;
            setTimeout(preencher, 0);
        }
    });
    function exigirCamposFactory(campos) {
        return function exigirCampos(requerido) {
            campos.forEach(campo => {
                campo.required = requerido;
            });
        };
    }
}
function exibirOrdemBloqueioValor(preferencias) {
    return query('form')
        .chain(form => sequenceAO(Validation, { juiz: queryInput('operadorAutran', form) }))
        .map(({ juiz }) => {
        const adicionar = adicionarCheckboxLembrar(preferencias);
        if (juiz.type !== 'hidden') {
            adicionar(juiz, "juiz" /* JUIZ */);
        }
        const preencherSeVazio = preencherSeVazioFactory(preferencias);
        preencherSeVazio(juiz, "juiz" /* JUIZ */);
    });
}
function focarSeVazio(inputs) {
    for (const input of inputs) {
        if (!input.disabled && input.value === '') {
            input.focus();
            return true;
        }
    }
    return false;
}
function liftA2(ax, ay, f) {
    return ay.ap(ax.map((x) => (y) => f(x, y)));
}
function liftA3(ax, ay, az, f) {
    return az.ap(ay.ap(ax.map((x) => (y) => (z) => f(x, y, z))));
}
function liftA4(aw, ax, ay, az, f) {
    return az.ap(ay.ap(ax.ap(aw.map((w) => (x) => (y) => (z) => f(w, x, y, z)))));
}
function incluirMinuta(tipoMinuta) {
    const paginaInclusao = `criarMinuta${tipoMinuta}Inclusao.do?method=criar`;
    const selector = 'table.fundoPadraoAClaro2 > tbody > tr:first-child > td:first-child';
    return queryMaybe(selector)
        .mapNullable(cell => cell.textContent)
        .map(txt => txt.split(/\n/))
        .mapNullable(xs => xs[2])
        .map(txt => [txt, '', 'Deseja incluir nova minuta?'].join('\n'))
        .map(msg => {
        setTimeout(() => {
            if (confirm(msg)) {
                location.href = paginaInclusao;
            }
        }, 0);
    })
        .fold(() => Validation.fail(`Não foi possível obter o resultado da inclusão.`), () => Validation.of(undefined));
}
function incluirMinutaBV(_) {
    return incluirMinuta('BV');
}
function incluirMinutaSI(_) {
    return incluirMinuta('SI');
}
function obterDadosProcesso(numproc, estado) {
    return new Task((rej, res) => {
        // WSDL: http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => res(xhr.responseXML));
        xhr.addEventListener('error', rej);
        xhr.open('POST', 'https://www2.trf4.jus.br/trf4/processos/acompanhamento/consultaws.php');
        xhr.setRequestHeader('SOAPAction', 'consulta_processual_ws_wsdl#ws_consulta_processo');
        xhr.send(`<?xml version="1.0" encoding="UTF-8"?>
		<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
				<soapenv:Header/>
				<soapenv:Body>
						<num_proc>${numproc}</num_proc>
						<uf>${estado}</uf>
						<todas_fases>N</todas_fases>
						<todas_partes>S</todas_partes>
						<todos_valores>N</todos_valores>
				</soapenv:Body>
		</soapenv:Envelope>`);
        return () => xhr.abort();
    })
        .chainLeft(() => Task.rejected(['Erro de rede.']))
        .chain(doc => {
        const parser = new DOMParser();
        return query('return', doc)
            .map(ret => ret.textContent || '')
            .map(ret => parser.parseFromString(ret, 'text/xml'))
            .toTask();
    })
        .chainLeft(() => Task.rejected(['Erro ao obter os dados do processo.']))
        .chain(processo => {
        const erros = queryAll('Erro', processo)
            .map(erro => (erro.textContent || '').trim())
            .filter(texto => texto !== '');
        if (erros.length) {
            return Task.rejected(erros);
        }
        const { autores, reus } = queryAll('Partes Parte', processo).reduce((partes, parte) => {
            const ehAutor = obterTexto('Autor', parte, 'N') === 'S';
            const ehReu = obterTexto('Réu, Reu', parte, 'N') === 'S';
            if (ehAutor === ehReu)
                return partes;
            const nome = obterTexto('Nome', parte);
            const documento = obterTexto('CPF_CGC', parte);
            return nome
                .map(nome => ((ehAutor ? partes.autores : partes.reus).push({ nome, documento }), partes))
                .getOrElse(partes);
        }, { autores: [], reus: [] });
        return sequenceAO(Maybe, {
            numproc: obterTexto('Processo Processo', processo),
            codClasse: obterTexto('CodClasse', processo),
        })
            .map(({ numproc, codClasse }) => ({
            numproc,
            codClasse,
            valCausa: obterTexto('ValCausa', processo)
                .map(Number)
                .filter(x => !isNaN(x)),
            autores,
            reus,
        }))
            .fold(() => Task.rejected(['Erro ao obter os dados do processo.']), x => Task.of(x));
    });
    function obterTexto(selector, context, defaultValue) {
        const maybe = queryMaybe(selector, context)
            .mapNullable(x => x.textContent)
            .filter(x => x.trim() !== '');
        return defaultValue === undefined ? maybe : maybe.getOrElse(defaultValue);
    }
}
function preencherSeVazioFactory(preferencias) {
    return (input, preferencia) => {
        preferencias.get(preferencia).ifJust(value => {
            if (input.value === '') {
                input.value = value;
            }
        });
    };
}
function queryAll(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}
function queryCampo(nome, form) {
    return new Validation((Failure, Success) => {
        const elt = form.elements.namedItem(nome);
        return elt === null ? Failure([`Campo não encontrado: "${nome}".`]) : Success(elt);
    });
}
function queryRadio(nome, form) {
    return queryCampo(nome, form);
}
function queryInput(nome, form) {
    return queryCampo(nome, form);
}
function querySelect(nome, form) {
    return queryCampo(nome, form);
}
function queryMaybe(selector, context = document) {
    return new Maybe((Nothing, Just) => {
        const elt = context.querySelector(selector);
        return elt === null ? Nothing() : Just(elt);
    });
}
function query(selector, context = document) {
    return new Validation((Failure, Success) => {
        const elt = context.querySelector(selector);
        return elt === null ? Failure([`Elemento não encontrado: '${selector}'.`]) : Success(elt);
    });
}
function sequenceAO(A, obj) {
    return Object.keys(obj).reduce((result, key) => obj[key].ap(result.map((dest) => (source) => Object.assign(dest, { [key]: source }))), A.of({}));
}
function sincronizarSelectInput(select, input, casoMude) {
    if (select.value) {
        input.value = select.value;
        casoMude();
    }
}
function whenDocumentInteractive() {
    return new Promise(res => {
        if (document.readyState === 'loading') {
            document.addEventListener('readystatechange', onReadyStateChange);
        }
        else {
            res();
        }
        function onReadyStateChange() {
            if (document.readyState !== 'loading') {
                document.removeEventListener('readystatechange', onReadyStateChange);
                res();
            }
        }
    });
}
const Paginas = new Map([
    ['dologin', dologin],
    ['conferirDadosMinutaBVInclusao', conferirDadosMinutaInclusao],
    ['conferirDadosMinutaSIInclusao', conferirDadosMinutaInclusao],
    ['consultarPessoa', consultarPessoa],
    ['consultarReu', consultarPessoa],
    ['consultarSolicitacoesProtocoladasAssessor', consultarPorAssessor],
    ['consultarSolicitacoesProtocoladasJuizo', consultarPorJuizo],
    ['consultarSolicitacoesProtocoladasProcesso', consultarPorProcesso],
    ['consultarSolicitacoesProtocoladasProtocolo', consultarPorProtocolo],
    ['criarMinutaBVInclusao', criarMinutaInclusao],
    ['criarMinutaSIInclusao', criarMinutaInclusao],
    ['exibirOrdemBloqueioValor', exibirOrdemBloqueioValor],
    ['incluirMinutaBV', incluirMinutaBV],
    ['incluirMinutaSI', incluirMinutaSI],
    ['pesquisarPorAssessor', consultarPorAssessor],
    ['pesquisarPorJuizo', consultarPorJuizo],
    ['pesquisarPorProcesso', consultarPorProcesso],
    ['pesquisarPorProtocolo', consultarPorProtocolo],
]);
main();
