"use strict";
async function main() {
    const preferencias = await carregarPreferencias();
    await whenDocumentInteractive();
    analisarPagina(preferencias);
}
Array.prototype.filterMap = function filterMap(f) {
    const ys = [];
    this.forEach(x => f(x).fold(() => { }, y => ys.push(y)));
    return ys;
};
Array.prototype.partition = function partition(p) {
    const { left, right } = this.partitionMap(x => (p(x) ? Right(x) : Left(x)));
    return { yes: right, no: left };
};
Array.prototype.partitionMap = function partitionMap(f) {
    const result = { left: [], right: [] };
    this.forEach(x => f(x).fold(l => result.left.push(l), r => result.right.push(r)));
    return result;
};
Array.prototype.sequenceA = function sequenceA(A) {
    return this.traverse(A, x => x);
};
Array.prototype.traverse = function traverse(A, f) {
    return this.reduce((axs, x) => f(x).ap(axs.map((xs) => (x) => (xs.push(x), xs))), A.of([]));
};
// Classes
/**
 * Objeto principal do programa
 */
class Bacen {
    constructor() {
        /**
         * Página sendo exibida
         */
        this.submit = false;
        this.valid = true;
        this.buscando = false;
        this.reus = [];
        this.secao = Nothing;
        this.subsecao = Nothing;
    }
    /**
     * Função inicial do programa
     */
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores -> Conferir dados da Minuta
     */
    async conferirDadosMinutaBVInclusao() {
        await this.tratarErros().catch(err => this.criarMinutaBVInclusao().then(() => Promise.reject(err)));
        try {
            (await obterSenhaJuiz()).focus();
        }
        catch (errSenhaJuiz) {
            const btnIncluir = await queryInputByName('btnIncluir');
            window.addEventListener('keypress', e => {
                if (e.keyCode !== 13 /* ENTER */)
                    return;
                e.preventDefault();
                e.stopPropagation();
                btnIncluir.click();
            });
        }
        function obterSenhaJuiz() {
            return queryInputByName('senhaJuiz').then(senhaJuiz => senhaJuiz.disabled
                ? Promise.reject(new Error('Campo "senhaJuiz" desabilitado.'))
                : Promise.resolve(senhaJuiz));
        }
    }
    /**
     * Menu Minutas -> Incluir Minuta de Requisição de Informações -> Conferir dados da Minuta
     */
    conferirDadosMinutaSIInclusao() {
        return this.conferirDadosMinutaBVInclusao();
    }
    /**
     * Janela pop-up aberta ao adicionar pessoa na tela de inclusão de minuta
     * de requisição de informações
     */
    consultarPessoa() {
        return this.consultarReu();
    }
    consultarSolicitacoesProtocoladas(nomeInput, tipo) {
        return Promise.all([queryInputByName(nomeInput), query('input.botao')]).then(([input, botao]) => {
            input.focus();
            input.addEventListener('change', () => tipo === 'processo'
                ? this.onConsultaProcessoChange(input)
                : this.onConsultaProtocoloChange(input));
            input.addEventListener('keypress', e => this.onProcessoKeypress(e, input));
            botao.addEventListener('click', e => this.onBotaoClick(e));
        });
    }
    /**
     * Menu Ordens judiciais -> Consultar Ordens Judiciais protocolizadas por Assessores
     */
    async consultarSolicitacoesProtocoladasAssessor() {
        return Promise.all([
            obterEFocar('dataInicial'),
            obterEFocar('cdOperadorAssessor', 'login'),
            obterEFocar('cdOperadorJuiz', 'juiz'),
        ]);
        async function obterEFocar(nomeInput, nomePreferencia) {
            const input = await queryInputByName(nomeInput);
            if (nomePreferencia === undefined) {
                input.focus();
                return;
            }
            return __Preferencias__.vincularInput(input, nomePreferencia, {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar Ordens Judiciais por Juízo
     */
    async consultarSolicitacoesProtocoladasJuizo() {
        return Promise.all([vincular('codigoVara', 'vara'), vincular('operador', 'juiz')]);
        async function vincular(nomeInput, nomePreferencia) {
            return __Preferencias__.vincularInput(await queryInputByName(nomeInput), nomePreferencia, {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial
     */
    consultarSolicitacoesProtocoladasProcesso() {
        return this.consultarSolicitacoesProtocoladas('numeroProcesso', 'processo');
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud
     */
    consultarSolicitacoesProtocoladasProtocolo() {
        return this.consultarSolicitacoesProtocoladas('numeroProtocolo', 'protocolo');
    }
    /**
     * Janela pop-up aberta ao adicionar réu
     */
    async consultarReu() {
        window.addEventListener('unload', () => Promise.resolve()
            .then(() => window.opener &&
            typeof window.opener === 'object' &&
            window.opener !== null &&
            !window.opener.closed &&
            window.opener.postMessage('processaLista', location.origin))
            .catch(err => console.error(err)));
        window.addEventListener('keypress', e => Promise.resolve()
            .then(() => {
            if (e.keyCode == 27 /* ESCAPE */) {
                window.close();
            }
        })
            .catch(err => console.error(err)));
    }
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores
     */
    async criarMinutaBVInclusao() {
        const erros = [];
        await Promise.all([queryInputByName('codigoVara'), queryInputByName('processo')])
            .then(([codigoVara, processo]) => {
            processo.addEventListener('change', () => this.onProcessoChange(processo), true);
            processo.addEventListener('keypress', e => this.onProcessoKeypress(e, processo), true);
            processo.focus();
            return __Preferencias__.vincularInput(codigoVara, 'vara', {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        })
            .catch(err => {
            erros.push(err);
        });
        await queryInputByName('cdOperadorJuiz')
            .then(input => input.type === 'hidden'
            ? Promise.reject(new Error('Campo "cdOperadorJuiz" oculto.'))
            : Promise.resolve(input))
            .then(cdOperadorJuiz => {
            return __Preferencias__.vincularInput(cdOperadorJuiz, 'juiz', {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        })
            .catch(errCdOperadorJuiz => {
            erros.push(errCdOperadorJuiz);
        });
        if (erros.length > 0) {
            return Promise.reject(new Error(erros.map(x => x.message).join('\n')));
        }
    }
    /**
     * Menu Minutas -> Incluir Minuta de Requisição de Informações
     */
    criarMinutaSIInclusao() {
        return this.criarMinutaBVInclusao();
    }
    /**
     * Obtém informações do processo e preenche automaticamente os campos
     */
    async getInfo(numproc, modo) {
        const estados = new Map([['70', 'PR'], ['71', 'RS'], ['72', 'SC']]);
        const estado = estados.get(this.secao.getOrElse('')) || 'SC';
        if (![10, 15, 20].includes(numproc.length)) {
            throw new Error('Número de processo inválido: ' + numproc);
        }
        const todas_partes = modo == 'preencher' ? 'S' : 'N';
        // WSDL: http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php
        const response = await fetch('https://www.trf4.jus.br/trf4/processos/acompanhamento/consultaws.php', {
            method: 'POST',
            headers: new Headers({
                SOAPAction: 'consulta_processual_ws_wsdl#ws_consulta_processo',
            }),
            body: `<?xml version="1.0" encoding="UTF-8"?>
			<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
					<soapenv:Header/>
					<soapenv:Body>
							<num_proc>${numproc}</num_proc>
							<uf>${estado}</uf>
							<todas_fases>N</todas_fases>
							<todas_partes>${todas_partes}</todas_partes>
							<todos_valores>N</todos_valores>
					</soapenv:Body>
			</soapenv:Envelope>`,
        });
        if (!response.ok) {
            console.error(response);
            throw new Error('Não foi possível obter os dados do processo.');
        }
        const text = await response.text();
        this.preencher(text, modo).catch(err => console.error(err));
    }
    /**
     * Retorna o número do processo devidamente formatado
     */
    getNumproc(input) {
        const numproc = input.replace(/[^0-9\/]/g, '');
        if (/^(\d{2}|\d{4})\/\d{2,9}$/.test(numproc)) {
            const [anoDigitado, numeroDigitado] = numproc.split('/');
            let ano = Number(anoDigitado);
            if (ano < 50) {
                ano = ano + 2000;
            }
            else if (ano >= 50 && ano < 100) {
                ano = ano + 1900;
            }
            const qtdDigitosVerificadores = ano >= 2010 ? 2 : 1;
            const numero = Number(numeroDigitado.slice(0, numeroDigitado.length - qtdDigitosVerificadores));
            const ramo = '4';
            const tribunal = '04';
            return liftA2(this.secao, this.subsecao, (secao, subsecao) => {
                const r1 = Number(numero) % 97;
                const r2 = Number([r1, ano, ramo, tribunal].join('')) % 97;
                const r3 = Number([r2, secao, subsecao, '00'].join('')) % 97;
                let dv = padLeft(2, 98 - r3);
                return [padLeft(7, numero), dv, ano, ramo, tribunal, secao, subsecao].join('');
            })
                .map(valor => ({ ok: true, valor }))
                .getOrElse({ ok: false, motivo: 'erroSecaoSubsecao' });
        }
        else if (numproc.match('/')) {
            return { ok: false, motivo: 'erroDigitacaoAbreviada', valorInformado: input };
        }
        else if ([10, 15, 20].includes(numproc.length)) {
            return { ok: true, valor: numproc };
        }
        else {
            return { ok: false, motivo: 'erroDigitacao', valorInformado: input };
        }
    }
    /**
     * Retorna o número do protocolo
     */
    getProtocolo(input) {
        const protocolo = input.replace(/[^0-9\/]/g, '');
        if (/^(\d{2}|\d{4})\/\d{1,10}$/.test(protocolo)) {
            const [anoDigitado, numeroDigitado] = protocolo.split('/');
            let ano = Number(anoDigitado);
            if (ano < 50) {
                ano = ano + 2000;
            }
            else if (ano >= 50 && ano < 100) {
                ano = ano + 1900;
            }
            const numero = Number(numeroDigitado);
            return { ok: true, valor: `${(padLeft(4, ano), padLeft(10, numero))}` };
        }
        else if (protocolo.match('/')) {
            return { ok: false, motivo: 'erroDigitacaoAbreviada', valorInformado: input };
        }
        else if (protocolo.length == 14) {
            return { ok: true, valor: protocolo };
        }
        else if (protocolo.length >= 1 && protocolo.length <= 10) {
            const ano = new Date().getFullYear();
            const numero = Number(protocolo);
            return { ok: true, valor: `${padLeft(4, ano)}${padLeft(10, numero)}` };
        }
        else {
            return { ok: false, motivo: 'erroDigitacao', valorInformado: input };
        }
    }
    incluirMinuta(tipoMinuta) {
        const paginaInclusao = `criarMinuta${tipoMinuta}Inclusao.do?method=criar`;
        const selector = 'table.fundoPadraoAClaro2 > tbody > tr:first-child > td:first-child';
        return query(selector)
            .then(cell => cell.textContent || '')
            .then(txt => txt.split(/\n/))
            .then(xs => (xs.length > 2 ? Promise.resolve(xs) : Promise.reject()))
            .then(xs => xs[2])
            .then(txt => [txt, '', 'Deseja incluir nova minuta?'].join('\n'))
            .then(msg => {
            setTimeout(() => {
                if (confirm(msg)) {
                    location.href = paginaInclusao;
                }
            }, 0);
        })
            .catch(() => Promise.reject(new Error(`Elemento não encontrador: "${selector}"`)));
    }
    /**
     * Minuta conferida e incluída
     */
    incluirMinutaBV() {
        this.incluirMinuta('BV');
    }
    /**
     * Minuta conferida e incluída
     */
    incluirMinutaSI() {
        this.incluirMinuta('SI');
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Botão "Consultar" -> Evento "click"
     */
    onBotaoClick(e) {
        e.preventDefault();
        e.stopPropagation();
        this.submit = true;
        if (this.submit && this.valid && !this.buscando) {
            Promise.all([
                queryInputByName('numeroProcesso').catch((err1) => queryInputByName('numeroProtocolo').catch((err2) => Promise.reject(new Error([err1, err2].map(x => x.message).join('\n'))))),
                query('form'),
            ])
                .then(([input, form]) => {
                input.select();
                input.focus();
                form.submit();
            })
                .catch(err => console.error(err));
        }
    }
    /**
     * Função que atende ao evento change do Número do Processo
     */
    onConsultaProcessoChange(input) {
        const valor = input.value;
        const numproc = this.getNumproc(valor);
        if (valor) {
            if (valor.match('/') && numproc.ok) {
                input.value = 'Carregando...';
                this.buscando = {
                    valor: valor,
                };
                this.getInfo(numproc.valor, 'consulta').catch(err => console.error(err));
                return;
            }
            if (numproc.ok) {
                input.value = numproc.valor;
                this.valid = true;
                return;
            }
            this.valid = false;
            alert('Número de processo inválido: "' + valor + '".');
            window.setTimeout(function () {
                input.value = valor;
                input.select();
                input.focus();
            }, 100);
        }
    }
    /**
     * Função que atende ao evento change do Número do Protocolo
     */
    onConsultaProtocoloChange(input) {
        const valor = input.value;
        const protocolo = this.getProtocolo(valor);
        if (valor && protocolo.ok) {
            input.value = protocolo.valor;
            this.valid = true;
        }
        else if (valor) {
            this.valid = false;
            alert('Número de protocolo inválido: "' + valor + '".');
            window.setTimeout(function () {
                input.select();
                input.focus();
            }, 100);
        }
    }
    /**
     * Função que atende ao evento change do Número do Processo
     */
    async onProcessoChange(input) {
        const valor = input.value;
        await queryInputByName('cdOperadorJuiz')
            .then(cdOperadorJuiz => {
            if (cdOperadorJuiz.type !== 'hidden') {
                cdOperadorJuiz.setAttribute('value', cdOperadorJuiz.value);
            }
        })
            .catch(() => { });
        await queryInputByName('codigoVara')
            .then(codigoVara => {
            codigoVara.setAttribute('value', codigoVara.value);
        })
            .catch(() => { });
        await query('form')
            .then(form => {
            form.reset();
        })
            .catch(() => { });
        await query('select[name="reus"]').then(select => {
            const reus = Array.from(select.options);
            if (reus.length) {
                reus.forEach(reu => (reu.selected = true));
                if (['criarMinutaBVInclusao', 'conferirDadosMinutaBVInclusao'].includes(this.pagina)) {
                    window.wrappedJSObject.excluirReu();
                }
                else if (['criarMinutaSIInclusao', 'conferirDadosMinutaSIInclusao'].includes(this.pagina)) {
                    window.wrappedJSObject.excluirPessoa();
                }
                else {
                    console.log('esta página', this.pagina);
                }
            }
        });
        if (valor) {
            input.value = 'Carregando...';
            const numproc = this.getNumproc(valor);
            if (numproc.ok) {
                this.buscando = {
                    valor: valor,
                };
                return this.getInfo(numproc.valor, 'preencher');
            }
            else {
                switch (numproc.motivo) {
                    case 'erroDigitacao':
                    case 'erroDigitacaoAbreviada':
                        alert(`Formato de número de processo desconhecido: ${numproc.valorInformado}`);
                        break;
                    case 'erroSecaoSubsecao':
                        alert('Para utilizar a digitação abreviada é preciso preencher os códigos de Seção e Subseção nas preferências da extensão.');
                        break;
                }
                setTimeout(() => {
                    input.value = valor;
                    input.select();
                    input.focus();
                }, 100);
            }
        }
    }
    /**
     * Função que atende ao evento keypress do campo Processo
     */
    onProcessoKeypress(e, input) {
        console.log('keypress', e.keyCode);
        if (![9 /* TAB */, 13 /* ENTER */].includes(e.keyCode))
            return;
        e.preventDefault();
        e.stopPropagation();
        if (input.name === 'processo') {
            query('select[name="idTipoAcao"]').then(idTipoAcao => {
                idTipoAcao.focus();
            });
        }
        else if (['numeroProcesso', 'numeroProtocolo'].includes(input.name)) {
            Promise.all([query('input.botao'), query('form')]).then(([botao, form]) => {
                this.submit = e.keyCode == 13 /* ENTER */;
                botao.focus();
                if (this.submit && this.valid && !this.buscando) {
                    input.select();
                    input.focus();
                    form.submit();
                }
            });
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Consultar
     *
     * @param String Método utilizado pela página
     */
    async pesquisarPorProcesso() {
        await this.tratarErros();
        return Promise.all([
            query('.pagebanner')
                .then(p => (p.textContent || '').match(/^\d+/))
                .then(x => (x === null ? Promise.reject() : Promise.resolve(x)))
                .then(xs => Number(xs[0]))
                .catch(() => Promise.reject(new Error('Elemento ".pagebanner" não possui conteúdo numérico.'))),
            query('table#ordem > tbody > tr:nth-child(1) > td:nth-child(3)').then(cell => query('a', cell)),
        ]).then(([registros, link]) => {
            if (registros === 1) {
                location.href = link.href;
            }
        });
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud -> Consultar
     */
    pesquisarPorProtocolo() {
        return this.tratarErros();
    }
    /**
     * Preenche os campos com as informações obtidas
     */
    async preencher(text, modo) {
        const parser = new DOMParser();
        const el = modo == 'preencher' ? 'processo' : 'numeroProcesso';
        const processo = await Promise.resolve(text)
            .then(txt => parser.parseFromString(txt, 'text/xml'))
            .then(doc => query('return', doc))
            .then(ret => ret.textContent || '')
            .then(ret => parser.parseFromString(ret, 'text/xml'));
        const campoProcesso = await queryInputByName(el);
        const erros = queryAll('Erro', processo)
            .map(erro => erro.textContent || '')
            .filter(texto => texto.trim() !== '');
        if (erros.length) {
            this.valid = false;
            const msg = erros.join('\n');
            alert(msg);
            campoProcesso.value = this.buscando.valor;
            this.buscando = false;
            campoProcesso.select();
            campoProcesso.focus();
            return Promise.reject(new Error(msg));
        }
        this.valid = true;
        this.buscando = false;
        await query('Processo Processo', processo)
            .then(p => p.textContent || '')
            .then(txt => txt.replace(/[^0-9]/g, ''))
            .then(value => {
            campoProcesso.value = value;
        });
        if (modo == 'preencher') {
            const tipoAcaoPorCodClasse = new Map([['000229', '1'], ['000098', '1'], ['000099', '4']]);
            await Promise.all([
                query('select[name="idTipoAcao"]'),
                query('CodClasse', processo).then(elt => elt.textContent || ''),
            ]).then(([tipoAcao, codClasse]) => {
                if (tipoAcaoPorCodClasse.has(codClasse)) {
                    tipoAcao.value = tipoAcaoPorCodClasse.get(codClasse);
                }
            });
            await Promise.all([
                queryInputByName('valorUnico'),
                query('ValCausa', processo)
                    .then(elt => elt.textContent || '')
                    .then(Number)
                    .then(x => isNaN(x) || x === 0
                    ? Promise.reject('Campo "ValCausa" não é um número válido.')
                    : Promise.resolve(x))
                    .then(formatNumber),
            ])
                .then(([campoValor, valor]) => {
                campoValor.value = valor;
            })
                .catch(err => console.error(err));
            const reus = [];
            function getText(p, defaultValue) {
                return p
                    .then(x => x.textContent)
                    .then(txt => (txt === null ? Promise.reject() : Promise.resolve(txt)))
                    .catch(() => defaultValue);
            }
            await Promise.all(queryAll('Partes Parte', processo).map(async (parte) => {
                if ((await getText(query('Autor', parte), 'N')) === 'S') {
                    (await queryInputByName('nomeAutor')).value = await getText(query('Nome', parte), '');
                    (await queryInputByName('cpfCnpjAutor')).value = await getText(query('CPF_CGC', parte), '');
                }
                else if ((await getText(query('Réu', parte).catch(() => query('Reu', parte)), 'N')) === 'S') {
                    reus.push(await getText(query('CPF_CGC', parte), ''));
                }
            }));
            this.processaLista(reus);
        }
        else if (modo == 'consulta') {
            if (this.submit) {
                Promise.all([queryInputByName('numeroProcesso'), query('form')]).then(([processo, form]) => {
                    processo.select();
                    processo.focus();
                    form.submit();
                });
            }
        }
    }
    /**
     * Adiciona os réus um a um
     */
    processaLista(reus) {
        if (reus !== undefined) {
            this.reus = reus;
            window.addEventListener('message', evt => {
                if (evt.origin === location.origin && evt.data === 'processaLista') {
                    this.processaLista();
                }
            });
        }
        if (this.reus.length) {
            const documento = this.reus.shift();
            Promise.all([
                query('#cpfCnpj'),
                query('#botaoIncluirCpfCnpj'),
            ]).then(([cpf, botao]) => {
                cpf.value = documento;
                botao.disabled = false;
                botao.focus();
                botao.click();
            });
        }
        else {
            query('select[name="idTipoAcao"]')
                .then(input => (input.value === '' ? Promise.resolve(input) : Promise.reject()))
                .then(input => {
                input.focus();
            })
                .catch(() => queryInputByName('valorUnico').then(input => {
                input.select();
                input.focus();
            }));
        }
    }
    async tratarErros() {
        const erros = queryAll('.msgErro')
            .map(erro => {
            erro.innerHTML = erro.innerHTML
                .replace(/\n?•(\&nbsp;)?/g, '')
                .replace('<b>', '&ldquo;')
                .replace('</b>', '&rdquo;');
            return (erro.textContent || '').trim();
        })
            .filter(x => x !== '');
        if (erros.length > 0) {
            const msg = erros.join('\n');
            alert(msg);
            throw new Error(msg);
        }
    }
}
class Either {
    constructor(fold) {
        this.fold = fold;
    }
    ap(that) {
        return that.chain(f => this.map(f));
    }
    bimap(f, g) {
        return this.fold(l => Left(f(l)), r => Right(g(r)));
    }
    chain(f) {
        return this.fold(Left, f);
    }
    chainLeft(f) {
        return this.fold(f, Right);
    }
    map(f) {
        return this.fold(Left, x => Right(f(x)));
    }
    mapLeft(f) {
        return this.fold(x => Left(f(x)), Right);
    }
    static of(value) {
        return Right(value);
    }
}
function Left(leftValue, _rightValue) {
    return new Either((L, _) => L(leftValue));
}
function Right(rightValue, _leftValue) {
    return new Either((_, R) => R(rightValue));
}
class IO {
    constructor(unsafePerformIO) {
        this.unsafePerformIO = unsafePerformIO;
    }
    ap(that) {
        return new IO(() => that.unsafePerformIO()(this.unsafePerformIO()));
    }
    chain(f) {
        return new IO(() => f(this.unsafePerformIO()).unsafePerformIO());
    }
    map(f) {
        return new IO(() => f(this.unsafePerformIO()));
    }
    static of(value) {
        return new IO(() => value);
    }
}
class Maybe {
    constructor(fold) {
        this.fold = fold;
    }
    alt(that) {
        return this.fold(() => that, Maybe.of);
    }
    altL(lazy) {
        return this.fold(lazy, () => this);
    }
    ap(that) {
        return that.chain(f => this.map(f));
    }
    chain(f) {
        return this.fold(() => Nothing, f);
    }
    concat(that) {
        return this.fold(() => that, xs => that.map(ys => xs.concat(ys)));
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
    getOrElseL(lazy) {
        return this.fold(lazy, x => x);
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
class __Preferencias__ {
    static init() {
        if (this.initialized)
            return;
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local')
                return;
            const changed = Object.keys(changes);
            changed.forEach(key => {
                const value = changes[key].newValue;
                if (this.inputs.has(key)) {
                    this.inputs.get(key).forEach(input => {
                        if (input.value.trim() === '') {
                            input.value = value || '';
                        }
                    });
                }
                const maybeValue = Maybe.fromNullable(value);
                if (this.callbacks.has(key)) {
                    this.callbacks.get(key).forEach(callback => {
                        callback(maybeValue);
                    });
                }
            });
        });
        this.initialized = true;
    }
    static observar(nome, callback) {
        this.callbacks.set(nome, (this.callbacks.get(nome) || []).concat(callback));
        return this.obter(nome).then(callback);
    }
    static obter(nome, valorPadrao) {
        const maybeValorPadrao = Maybe.fromNullable(valorPadrao);
        return browser.storage.local
            .get(nome)
            .then(prefs => Maybe.fromNullable(prefs[nome]))
            .then(maybe => maybeValorPadrao.fold(() => maybe, valor => maybe.getOrElse(valor)));
    }
    static async vincularInput(input, nome, opcoes = {
        focarSeVazio: false,
        salvarAoPreencher: true,
    }) {
        if (opcoes.salvarAoPreencher) {
            input.addEventListener('change', () => {
                const valor = input.value.trim();
                const promise = valor !== ''
                    ? browser.storage.local.set({ [nome]: valor })
                    : browser.storage.local.remove(nome);
                promise.catch(err => console.error(err));
            });
        }
        this.inputs.set(nome, (this.inputs.get(nome) || []).concat([input]));
        const valor = await this.obter(nome);
        valor.fold(() => {
            input.value = '';
            if (opcoes.focarSeVazio)
                input.focus();
        }, x => {
            input.value = x;
        });
    }
}
__Preferencias__.initialized = false;
__Preferencias__.inputs = new Map();
__Preferencias__.callbacks = new Map();
class QueryError extends Error {
    constructor(msg, data) {
        super(msg);
        this.data = data;
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
    toPromise() {
        return new Promise((res, rej) => this.fold(rej, res));
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
    return function ({ input, preferencia }) {
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
        observar(name, listener) {
            listeners.set(name, (listeners.get(name) || []).concat([listener]));
            listener(this.get(name));
        },
        set(name, value) {
            return browser.storage.local.set({ [name]: value });
        },
        remove(name) {
            return browser.storage.local.remove(name);
        },
    };
}
function conferirDadosMinutaBVInclusao(preferencias) {
    return queryErros().fold(() => criarMinutaBVInclusao(preferencias), () => query('form')
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
    }));
}
function criarMinutaBVInclusao(preferencias) {
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
        docReu: query('#cpfCnpj'),
        reus: querySelect('reus', form),
    }))
        .map(elementos => {
        const { form, juiz, vara, processo, tipo, nomeAutor, idVara } = elementos;
        [juiz, vara, processo, tipo, nomeAutor]
            .concat(queryAll('input[name="valorUnico"]', form))
            .forEach(campo => {
            campo.required = true;
        });
        const adicionar = adicionarCheckboxLembrar(preferencias);
        Maybe.of({ input: juiz, preferencia: "juiz" /* JUIZ */ })
            .filter(({ input }) => input.type !== 'hidden')
            .ifJust(adicionar);
        const salvarVara = adicionar({ input: vara, preferencia: "vara" /* VARA */ });
        idVara.addEventListener('change', () => {
            sincronizar();
            salvarVara();
        });
        sincronizar();
        preencherSeVazio(juiz, "juiz" /* JUIZ */);
        preencherSeVazio(vara, "vara" /* VARA */);
        const substituir = new Map([['d', '[0-9]'], ['.', '\\.?'], ['-', '-?']]);
        processo.pattern = ['dd.dd.ddddd-d', 'dddd.dd.dd.dddddd-d', 'ddddddd-dd.dddd.d.dd.dddd']
            .map(pattern => pattern.replace(/(\?*)(d*)(\?*)/g, (_, opt1, req, opt2) => {
            const optional = opt1.length + opt2.length;
            const required = req.length;
            const total = optional + required;
            if (total === 0)
                return '';
            if (total === 1) {
                if (required)
                    return 'd';
                return 'd?';
            }
            if (optional === 0) {
                return `d{${required}}`;
            }
            return `d{${required},${total}}`;
        }))
            .map(pattern => pattern.replace(/./g, x => substituir.get(x) || x))
            .join('|');
        processo.title =
            'Digite o número do processo com 10, 15 ou 20 dígitos (pontos e traços opcionais)';
        focarSeVazio([juiz, vara, processo]);
        const template = document.createElement('template');
        template.innerHTML = `<div id="blocking" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 50%); display: none; font-size: 10vmin; color: white; justify-content: center; align-items: center; cursor: default;">Aguarde, carregando...</div>`;
        const div = document.importNode(template.content, true).firstChild;
        document.body.appendChild(div);
        let evitarSubmit = true;
        processo.addEventListener('change', evt => {
            if (!processo.willValidate) {
                return;
            }
            Promise.resolve()
                .then(() => {
                evitarSubmit = true;
                div.style.display = 'grid';
            })
                .then(() => obterDadosProcesso(processo.value, 'SC'))
                .then(({ numproc, codClasse, valCausa, autores, reus }) => {
                processo.value = numproc;
                const tipoAcaoPorCodClasse = new Map([
                    ['000229', '1'],
                    ['000098', '1'],
                    ['000099', '4'],
                ]);
            })
                .catch(err => {
                console.error(err);
                alert('Não foi possível obter os dados do processo.');
            })
                .then(() => {
                evitarSubmit = false;
                div.style.display = 'none';
            });
        });
        form.addEventListener('submit', evt => {
            if (evitarSubmit) {
                evt.preventDefault();
            }
        });
        function sincronizar() {
            if (idVara.value)
                vara.value = idVara.value;
        }
    });
    function preencherSeVazio(input, preferencia) {
        preferencias.get(preferencia).ifJust(value => {
            if (input.value === '') {
                input.value = value;
            }
        });
    }
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
        [unidade, operador, senha, cpf]
            .concat(queryAll('input[name="senhanova"], input[name="senhanova2"]', form))
            .forEach(input => {
            input.required = true;
        });
        [
            { input: unidade, preferencia: "unidade" /* UNIDADE */ },
            { input: operador, preferencia: "operador" /* OPERADOR */ },
            { input: cpf, preferencia: "cpf" /* CPF */ },
        ].forEach(adicionarCheckboxLembrar(preferencias));
        opcoesLogin.forEach(opcao => {
            opcao.addEventListener('click', verificarFoco);
        });
        window.addEventListener('load', verificarFoco);
        if (document.readyState === 'complete')
            verificarFoco();
        function preencher() {
            preencherSeVazio(unidade, "unidade" /* UNIDADE */);
            preencherSeVazio(operador, "operador" /* OPERADOR */);
            preencherSeVazio(cpf, "cpf" /* CPF */);
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
    function preencherSeVazio(input, preferencia) {
        preferencias.get(preferencia).ifJust(value => {
            if (input.value === '') {
                input.value = value;
            }
        });
    }
}
function focarSeVazio(inputs) {
    for (const input of inputs) {
        if (!input.disabled && input.value === '') {
            input.focus();
            return;
        }
    }
}
function formatNumber(num) {
    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        minimumIntegerDigits: 1,
        useGrouping: true,
    });
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
function observarPreferenciaFactory(preferencias) {
    return function observarPreferencia(input, preferencia) {
        preferencias.observar(preferencia, maybe => {
            input.setAttribute('placeholder', maybe.getOrElse(''));
        });
    };
}
async function obterDadosProcesso(numproc, estado) {
    // WSDL: http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php
    const response = await fetch('https://www.trf4.jus.br/trf4/processos/acompanhamento/consultaws.php', {
        method: 'POST',
        headers: new Headers({
            SOAPAction: 'consulta_processual_ws_wsdl#ws_consulta_processo',
        }),
        body: `<?xml version="1.0" encoding="UTF-8"?>
		<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
				<soapenv:Header/>
				<soapenv:Body>
						<num_proc>${numproc}</num_proc>
						<uf>${estado}</uf>
						<todas_fases>N</todas_fases>
						<todas_partes>S</todas_partes>
						<todos_valores>N</todos_valores>
				</soapenv:Body>
		</soapenv:Envelope>`,
    });
    if (!response.ok) {
        console.error(response);
        throw new Error('Não foi possível obter os dados do processo.');
    }
    const text = await response.text();
    const parser = new DOMParser();
    const processo = await Promise.resolve(text)
        .then(txt => parser.parseFromString(txt, 'text/xml'))
        .then(doc => query('return', doc).toPromise())
        .then(ret => ret.textContent || '')
        .then(ret => parser.parseFromString(ret, 'text/xml'));
    const erros = queryAll('Erro', processo)
        .map(erro => erro.textContent || '')
        .filter(texto => texto.trim() !== '');
    if (erros.length) {
        return Promise.reject(erros);
    }
    const { autores, reus } = queryAll('Partes Parte', processo).reduce((partes, parte) => {
        const ehAutor = obterTexto(queryMaybe('Autor', parte), 'N') === 'S';
        const ehReu = obterTexto(queryMaybe('Réu, Reu', parte), 'N') === 'S';
        if (ehAutor === ehReu)
            return partes;
        const nome = obterTexto(queryMaybe('Nome', parte));
        const documento = obterTexto(queryMaybe('CPF_CGC', parte));
        return nome
            .map(nome => ((ehAutor ? partes.autores : partes.reus).push({ nome, documento }), partes))
            .getOrElse(partes);
    }, { autores: [], reus: [] });
    return sequenceAO(Maybe, {
        numproc: obterTexto(queryMaybe('Processo Processo', processo)),
        codClasse: obterTexto(queryMaybe('CodClasse', processo)),
    })
        .map(({ numproc, codClasse }) => ({
        numproc,
        codClasse,
        valCausa: obterTexto(queryMaybe('ValCausa', processo))
            .map(Number)
            .filter(x => !isNaN(x)),
        autores,
        reus,
    }))
        .fold(() => Promise.reject(), x => Promise.resolve(x));
    function obterTexto(p, defaultValue) {
        const maybe = p.mapNullable(x => x.textContent).filter(x => x.trim() !== '');
        return defaultValue === undefined ? maybe : maybe.getOrElse(defaultValue);
    }
}
function padLeft(size, number) {
    let result = String(number);
    while (result.length < size) {
        result = `0${result}`;
    }
    return result;
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
function queryErros() {
    return new Validation((Failure, Success) => {
        const erros = queryAll('.msgErro')
            .map(erro => {
            const elt = erro.cloneNode(true);
            elt.innerHTML = elt.innerHTML
                .replace(/\n?•(\&nbsp;)?/g, '')
                .replace('<b>', '&ldquo;')
                .replace('</b>', '&rdquo;');
            return (elt.textContent || '').trim();
        })
            .filter(x => x !== '');
        return erros.length > 0 ? Failure(erros) : Success(undefined);
    });
}
function validarNumeroProcesso(input, secao, subsecao) {
    const numproc = input.replace(/[^0-9\/]/g, '');
    if (/^(\d{2}|\d{4})\/\d{2,9}$/.test(numproc)) {
        const [anoDigitado, numeroDigitado] = numproc.split('/');
        let ano = Number(anoDigitado);
        if (ano < 50) {
            ano = ano + 2000;
        }
        else if (ano >= 50 && ano < 100) {
            ano = ano + 1900;
        }
        const qtdDigitosVerificadores = ano >= 2010 ? 2 : 1;
        const numero = Number(numeroDigitado.slice(0, numeroDigitado.length - qtdDigitosVerificadores));
        const ramo = '4';
        const tribunal = '04';
        return liftA2(secao, subsecao, (secao, subsecao) => {
            const r1 = Number(numero) % 97;
            const r2 = Number([r1, ano, ramo, tribunal].join('')) % 97;
            const r3 = Number([r2, secao, subsecao, '00'].join('')) % 97;
            let dv = padLeft(2, 98 - r3);
            return [padLeft(7, numero), dv, ano, ramo, tribunal, secao, subsecao].join('');
        })
            .map(valor => ({ ok: true, valor }))
            .getOrElse({ ok: false, motivo: 'erroSecaoSubsecao' });
    }
    else if (numproc.match('/')) {
        return { ok: false, motivo: 'erroDigitacaoAbreviada', valorInformado: input };
    }
    else if ([10, 15, 20].includes(numproc.length)) {
        return { ok: true, valor: numproc };
    }
    else {
        return { ok: false, motivo: 'erroDigitacao', valorInformado: input };
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
    ['conferirDadosMinutaBVInclusao', conferirDadosMinutaBVInclusao],
    ['conferirDadosMinutaSIInclusao', conferirDadosMinutaBVInclusao],
    ['criarMinutaBVInclusao', criarMinutaBVInclusao],
    ['criarMinutaSIInclusao', criarMinutaBVInclusao],
]);
main();
