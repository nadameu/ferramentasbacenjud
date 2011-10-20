// {{{ $()
/**
 * Atalho para document.getElementById()
 *
 * @param String Id do elemento
 * @return HTMLElement Elemento buscado
 */
var $ = function(id)
{
    return document.getElementById(id);
}
// }}}
// {{{ $$()
/**
 * Obtém todos os elementos com uma determinada tag
 *
 * @param String Tag do elemento
 * @return Array Elementos buscados
 */
var $$ = function(tag)
{
    return document.getElementsByTagName(tag);
}
// }}}
// {{{ $A()
/**
 * Retorna um Array com os elementos do conjunto passado como argumento
 *
 * @param mixed Conjunto
 * @return Array Matriz
 */
var $A = function(group)
{
    return Array.prototype.slice.call(group);
}
// }}}
// {{{ $F()
/**
 * Obtém um elemento de formulário através de seu nome
 *
 * @param String Nome do elemento (atributo "name" HTML)
 * @return HTMLElement Elemento buscado
 */
var $F = function(name)
{
    return document.getElementsByName(name)[0];
}
// }}}
// {{{ Bacen
/**
 * Objeto principal do programa
 */
var Bacen = {
    // {{{ Variáveis
    /**
     * Método utilizado
     */
    method: '',
    /**
     * Página sendo exibida
     */
    pagina: '',
    /**
     * Código da vara/juízo
     */
    vara: '2379',
    // }}}
    // {{{ bind()
    /**
     * Vincula uma função a um evento
     *
     * @param Function Função a ser vinculada
     * @param* mixed Outros parâmetros a serem passados à função
     * @return Function Função a ser executada
     */
    bind: function(f)
    {
        var args = $A(arguments);
        args.splice(0, 1);
        var self = this;
        return function(e)
        {
            f.apply(self, $A(arguments).concat(args).concat([this]));
        }
    },
    // }}}
    // {{{ conferirDadosMinutaBVInclusao()
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores -> Conferir dados da Minuta
     *
     * @param String Método utilizado pela página
     */
    conferirDadosMinutaBVInclusao: function(method)
    {
        if (method == 'conferirDados') {
            var erros, msgErro = '';
            if ((erros = document.getElementsByClassName('msgErro')).length) {
                $A(erros).forEach(function(erro, e)
                {
                    erro.innerHTML = erro.innerHTML.replace(/\n?•(\&nbsp;)?/g, '').replace('<b>', '&ldquo;').replace('</b>', '&rdquo;');
                    msgErro += erro.textContent + '\n';
                });
                alert(msgErro);
                history.go(-1);
            } else if ($F('senhaJuiz')) {
                $F('senhaJuiz').focus();
            }
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ consultarSolicitacoesProtocoladasJuizo()
    /**
     * Menu Ordens judiciais -> Consultar Ordens Judiciais por Juízo
     *
     * @param String Método utilizado pela página
     */
    consultarSolicitacoesProtocoladasJuizo: function(method)
    {
        if (method == 'editarCriteriosConsultaPorVara') {
            if ($F('codigoVara')) {
                $F('codigoVara').value = this.vara;
            }
            if ($F('operador')) {
                $F('operador').value = $$('table')[1].getElementsByTagName('div')[0].textContent.split('.')[1];
            }
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ consultarSolicitacoesProtocoladasProcesso()
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial
     *
     * @param String Método utilizado pela página
     */
    consultarSolicitacoesProtocoladasProcesso: function(method)
    {
        if (method == 'editarCriteriosConsultaPorProcesso') {
            if ($F('numeroProcesso')) {
                $F('numeroProcesso').focus();
                $F('numeroProcesso').addEventListener('change', this.bind(this.onConsultaProcessoChange), true);
                $F('numeroProcesso').addEventListener('keypress', this.bind(this.onProcessoKeypress), true);
                document.getElementsByClassName('botao')[0].addEventListener('click', this.bind(this.onBotaoClick), true);
            }
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ consultarSolicitacoesProtocoladasProtocolo()
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud
     *
     * @param String Método utilizado pela página
     */
    consultarSolicitacoesProtocoladasProtocolo: function(method)
    {
        if (method == 'editarCriteriosConsultaPorProtocolo') {
            if ($F('numeroProtocolo')) {
                $F('numeroProtocolo').focus();
                $F('numeroProtocolo').addEventListener('change', this.bind(this.onConsultaProtocoloChange), true);
                $F('numeroProtocolo').addEventListener('keypress', this.bind(this.onProcessoKeypress), true);
                document.getElementsByClassName('botao')[0].addEventListener('click', this.bind(this.onBotaoClick), true);
            }
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ consultarReu()
    /**
     * Janela pop-up aberta ao adicionar réu
     *
     * @param String Método utilizado
     */
    consultarReu: function(method)
    {
        if (method == 'consultarReu') {
            window.addEventListener('unload', function(e)
            {
                opener.setTimeout("Bacen.processaLista();", 100);
            }, true);
            window.addEventListener('keypress', function(e)
            {
                if (e.keyCode == 27) {
                    window.close();
                }
            }, true);
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ criarMinutaBVInclusao()
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores
     *
     * @param String Método utilizado pela página
     */
    criarMinutaBVInclusao: function(method)
    {
        if (method == 'criar') {
            if ($F('codigoVara') && $F('processo')) {
                $F('codigoVara').setAttribute('value', this.vara);
                $F('processo').select();
                $F('processo').focus();
                $F('processo').addEventListener('change', this.bind(this.onProcessoChange), true);
                $F('processo').addEventListener('keypress', this.bind(this.onProcessoKeypress), true);
            }
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ criarMinutaSIInclusao()
    /**
     * Menu Minutas -> Incluir Minuta de Requisição de Informações
     *
     * @param String Método utilizado pela página
     */
    criarMinutaSIInclusao: function(method)
    {
        this.criarMinutaBVInclusao(method);
    },        
    // }}}
    // {{{ exibirOrdemBloqueioValor()
    /**
     * Detalhamento de Ordem Judicial de Bloqueio de Valores
     *
     * @param String Método utilizado pela página
     */
    exibirOrdemBloqueioValor: function(method)
    {
        if (method == 'exibir') {
            var ordem, bloqueios = [], bloqueado = 0;
            $A(document.getElementsByTagName('input')).forEach(function(input, i, inputs)
            {
                if (input.id.match(/^valor\d+$/)) {
                    var infoRow = input.parentNode.parentNode;
                    infoRow = infoRow.parentNode.rows[infoRow.rowIndex - 1];
                    ordem = Number(infoRow.cells[3].textContent.replace(/\./g, '').replace(',', '.'));
                    var valor = Number(infoRow.cells[5].textContent.replace(/\./g, '').replace(',', '.'));
                    bloqueado += valor;
                    bloqueios.push({id: input.id, valor: valor});
                }
            });
            if (bloqueios.length > 0) {
                if (bloqueado < ordem) {
                    var minimo = Number(prompt('Ignorar bloqueio se não ultrapassar R$', '0,00').replace(/\./g, '').replace(',', '.'));
                    if (bloqueado <= minimo) {

                    }
                }
                alert(bloqueado);
                alert(minimo);
            } else {
                window.print();
                history.go(-1);
            }
            return;
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ getInfo()
    /**
     * Obtém informações do processo e preenche automaticamente os campos
     *
     * @param String Número do processo
     * @param String Modo de preenchimento
     */
    getInfo: function(numproc, modo)
    {
        if (numproc.length != 10 && numproc.length != 15 && numproc.length != 20) {
            throw new Error('Número de processo inválido: ' + numproc);
        } else if (modo != 'consulta' && modo != 'preencher') {
            throw new Error('Modo inválido: ' + modo);
        }
        var todas_partes = (modo == 'preencher' ? 'S' : 'N');
        var options = {
            method: 'POST',
            url: 'http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php',
            data: '<?xml version="1.0" encoding="UTF-8"?>' + <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:consulta_processual" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><SOAP-ENV:Body><ns1:ws_consulta_processo><num_proc xsi:type="xsd:string">{numproc}</num_proc><uf xsi:type="xsd:string">SC</uf><todas_fases xsi:type="xsd:string">N</todas_fases><todas_partes xsi:type="xsd:string">{todas_partes}</todas_partes><todos_valores>N</todos_valores></ns1:ws_consulta_processo></SOAP-ENV:Body></SOAP-ENV:Envelope>.toString(),
            onload: this.bind(this.preencher, modo),
        }
        GM_xmlhttpRequest(options);
    },
    // }}}
    // {{{ getNumproc()
    /**
     * Retorna o número do processo devidamente formatado
     *
     * @param String Número do processo
     * @return false|String Número do processo
     */
    getNumproc: function(numproc)
    {
        var secao_antiga = '50', secao = '72', subsecao = '08', ramo = '4', tribunal = '04';
        numproc = numproc.replace(/[^0-9\/]/g, '');
        if (/^(\d{2}|\d{4})\/\d{2,9}$/.test(numproc)) {
            var tmp = numproc.split('/');
            var ano = tmp[0];
            if (ano < 50) {
                ano = Number(ano) + 2000;
            } else if (ano >= 50 && ano < 100) {
                ano = Number(ano) + 1900;
            }
            if (ano >= 2010) {
                var numero = tmp[1].substr(0, tmp[1].length -2);
            } else {
                var numero = tmp[1].substr(0, tmp[1].length -1);
            }
        } else if (numproc.match('/')) {
            return false;
        } else if (numproc.length == 10 || numproc.length == 15 || numproc.length == 20) {
            return numproc;
        } else {
            return false;
        }
        while (numero.length < 7) {
            numero = '0' + numero;
        }
        var r1 = Number(numero) % 97;
        var r2 = Number('' + r1 + ano + ramo + tribunal) % 97;
        var r3 = Number('' + r2 + secao + subsecao + '00') % 97;
        var dv = String(98 - r3);
        while (dv.length < 2) dv = '0' + dv;
        var numproc = '' + numero + dv + ano + ramo + tribunal + secao + subsecao;
        return numproc;
    },
    // }}}
    // {{{ getProtocolo()
    /**
     * Retorna o número do protocolo
     *
     * @param String Número do protocolo
     * @return false|String Número do protocolo
     */
    getProtocolo: function(protocolo)
    {
        protocolo = protocolo.replace(/[^0-9\/]/g, '');
        if (/^(\d{2}|\d{4})\/\d{1,10}$/.test(protocolo)) {
            var tmp = protocolo.split('/');
            var ano = tmp[0];
            if (ano < 50) {
                ano = Number(ano) + 2000;
            } else if (ano >= 50 && ano < 100) {
                ano = Number(ano) + 1900;
            }
            var numero = tmp[1];
        } else if (protocolo.match('/')) {
            return false;
        } else if (protocolo.length == 14) {
            return protocolo;
        } else if (protocolo.length >= 1 && protocolo.length <= 10) {
            var ano = (new Date()).getFullYear();
            var numero = protocolo;
        } else {
            return false;
        }
        while (protocolo.length < 10) protocolo = '0' + protocolo;
        return ano + protocolo;
    },
    // }}}
    // {{{ incluirMinutaBV()
    /**
     * Minuta conferida e incluída
     *
     * @param String Método
     */
    incluirMinutaBV: function(method)
    {
        if (method == 'incluir') {
            if (document.getElementsByClassName('fundoPadraoAClaro2').length) {
                if (confirm(document.getElementsByClassName('fundoPadraoAClaro2')[0].rows[0].cells[0].textContent.split(/\n/)[2] + '\n\nDeseja incluir nova minuta?')) {
                    location.href = 'https://www3.bcb.gov.br/bacenjud2/criarMinutaBVInclusao.do?method=criar';
                }
            }
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ init()
    /**
     * Função inicial do programa
     */
    init: function()
    {
        this.pagina = location.pathname.split('/bacenjud2/')[1].split('.')[0];
        var parametros = location.search.split('?');
        if (parametros.length == 2) {
            parametros = parametros[1].split('&');
            var self = this;
            parametros.forEach(function(parametro, p)
            {
                var fv = parametro.split('=');
                if (fv[0] == 'method') {
                    self.method = fv[1];
                }
            });
        }
        if (this[this.pagina]) this[this.pagina](this.method);
    },
    // }}}
    // {{{ onBotaoClick()
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Botão "Consultar" -> Evento "click"
     *
     * @param Event Evento disparado
     * @param HTMLElement Elemento que disparou o evento
     */
    onBotaoClick: function(e, input)
    {
        e.preventDefault();
        e.stopPropagation();
        this.submit = true;
        if (this.submit && this.valid && !this.buscando) {
            if ($F('numeroProcesso')) {
                $F('numeroProcesso').select();
                $F('numeroProcesso').focus();
            } else if ($F('numeroProtocolo')) {
                $F('numeroProtocolo').select();
                $F('numeroProtocolo').focus();
            }
            $$('form')[0].submit();
        }
    },
    // }}}
    // {{{ onConsultaProcessoChange()
    /**
     * Função que atende ao evento change do Número do Processo
     *
     * @param Event Evento disparado
     * @param HTMLElement Elemento que disparou o evento
     */
    onConsultaProcessoChange: function(e, input)
    {
        var valor = input.value.toString();
        var numproc = this.getNumproc(valor);
        if (valor) {
            if (valor.match('/') && numproc) {
                input.value = 'Carregando...';
                this.buscando = {
                    valor: valor,
                }
                this.getInfo(numproc, 'consulta');
            } else if (numproc) {
                input.value = numproc;
                this.valid = true;
            } else {
                this.valid = false;
                alert('Número de processo inválido: "' + valor + '".');
                window.setTimeout(function() {
                    input.value = valor;
                    input.select();
                    input.focus();
                }, 100);
            }
        }
    },
    // }}}
    // {{{ onConsultaProtocoloChange()
    /**
     * Função que atende ao evento change do Número do Protocolo
     *
     * @param Event Evento disparado
     * @param HTMLElement Elemento que disparou o evento
     */
    onConsultaProtocoloChange: function(e, input)
    {
        var valor = input.value.toString();
        var protocolo = this.getProtocolo(valor);
        GM_log(protocolo);
        if (valor && protocolo) {
            input.value = protocolo;
            this.valid = true;
        } else if (valor) {
            this.valid = false;
            alert('Número de protocolo inválido: "' + valor + '".');
            window.setTimeout(function() {
                input.select();
                input.focus();
            }, 100);
        }
    },
    // }}}
    // {{{ onProcessoChange()
    /**
     * Função que atende ao evento change do Número do Processo
     *
     * @param Event Evento disparado
     * @param HTMLElement Elemento que disparou o evento
     */
    onProcessoChange: function(e, input)
    {
        var valor = input.value.toString();
        $$('form')[0].reset();
        var reus = $A($F('reus').getElementsByTagName('option'));
        reus.forEach(function(reu)
        {
            reu.selected = true;
        });
        if (reus.length) unsafeWindow.excluirReu();
        if (valor) {
            input.value = 'Carregando...';
            var numproc = this.getNumproc(valor);
            if (numproc) {
                this.buscando = {
                    valor: valor,
                }
                this.getInfo(numproc, 'preencher');
            } else {
                alert('Número de processo inválido: "' + valor + '".');
                window.setTimeout(function() {
                    input.value = valor;
                    input.select();
                    input.focus();
                }, 100);
            }
        }
    },
    // }}}
    // {{{ onProcessoKeypress()
    /**
     * Função que atende ao evento keypress do campo Processo
     *
     * @param Event Evento disparado
     * @param HTMLElement Elemento que disparou o evento
     */
    onProcessoKeypress: function(e, input)
    {
        if (e.keyCode == 9 || e.keyCode == 13) {
            e.preventDefault();
            e.stopPropagation();
            if (input.name == 'processo') {
                $F('idTipoAcao').focus();
            } else if (input.name == 'numeroProcesso' || input.name == 'numeroProtocolo') {
                this.submit = (e.keyCode == 13) ? true : false;
                document.getElementsByClassName('botao')[0].focus();
                if (this.submit && this.valid && !this.buscando) {
                    input.select();
                    input.focus();
                    $$('form')[0].submit();
                }
            }
        }
    },
    // }}}
    // {{{ pesquisarPorProcesso()
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Consultar
     *
     * @param String Método utilizado pela página
     */
    pesquisarPorProcesso: function(method)
    {
        if (method == 'pesquisarPorProcesso') {
            var erros, msgErro = '';
            if ((erros = document.getElementsByClassName('msgErro')).length) {
                $A(erros).forEach(function(erro)
                {
                    erro.innerHTML = erro.innerHTML.replace(/\n?•(\&nbsp;)?/g, '').replace('<b>', '&ldquo;').replace('</b>', '&rdquo;');
                    msgErro += erro.textContent + '\n';
                });
                alert(msgErro);
                history.go(-1);
            } else if (document.getElementsByClassName('pagebanner').length) {
                var registros = document.getElementsByClassName('pagebanner')[0].textContent.match(/^\d+/);
                if (registros == 1) {
                    location.href = document.getElementById('ordem').rows[1].cells[3].getElementsByTagName('a')[0].href;
                }
            }
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ pesquisarPorProtocolo()
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud -> Consultar
     *
     * @param String Método utilizado pela página
     */
    pesquisarPorProtocolo: function(method)
    {
        if (method == 'pesquisarPorProtocolo') {
            var erros, msgErro = '';
            if ((erros = document.getElementsByClassName('msgErro')).length) {
                $A(erros).forEach(function(erro)
                {
                    erro.innerHTML = erro.innerHTML.replace(/\n?•(\&nbsp;)?/g, '').replace('<b>', '&ldquo;').replace('</b>', '&rdquo;');
                    msgErro += erro.textContent + '\n';
                });
                alert(msgErro);
                history.go(-1);
            }
        } else {
            throw new Error('Método desconhecido: ' + method);
        }
    },
    // }}}
    // {{{ preencher()
    /**
     * Preenche os campos com as informações obtidas
     *
     * @param GM_xmlhttpRequest Objeto retornado
     * @param String Modo de preenchimento
     * @param Object Opções passadas ao objeto
     */
    preencher: function(obj, modo, options)
    {
        if (modo != 'preencher' && modo != 'consulta') {
            throw new Error('Modo inválido: ' + modo);
        }
        var div = document.createElement('div');
        div.innerHTML = obj.responseText;
        var processo = eval(div.getElementsByTagName('return')[0].textContent.replace(/<\?xml[^\?]*\?>/, ''));
        var erros = [];
        for (var erro in processo.Erro) {
            erros.push(processo.Erro[erro]);
        }
        var el = (modo == 'preencher' ? 'processo' : 'numeroProcesso');
        if ($F(el)) {
            if (erros.length) {
                this.valid = false;
                alert(erros.join('\n'));
                $F(el).value = this.buscando.valor;
                delete this.buscando;
                $F(el).select();
                $F(el).focus();
            } else {
                this.valid = true;
                delete this.buscando;
                $F(el).value = processo.Processo.toString().replace(/[^0-9]/g, '');
                if (modo == 'preencher') {
                    if (processo.CodClasse == '000099') {
                        $F('idTipoAcao').value = 4;
                    }
                    var reus = [];
                    for (var p in processo.Partes.Parte) {
                        var parte = processo.Partes.Parte[p];
                        if (parte.Autor == 'S') {
                            $F('nomeAutor').value = parte.Nome;
                            $F('cpfCnpjAutor').value = parte.CPF_CGC;
                        } else if (parte.Réu == 'S' || parte.Reu == 'S') {
                            reus.push(parte.CPF_CGC);
                        }
                    }
                    this.processaLista(reus);
                } else if (modo == 'consulta') {
                    if (this.submit) {
                        $F('numeroProcesso').select();
                        $F('numeroProcesso').focus();
                        $$('form')[0].submit();
                    }
                } else {
                    throw new Error('Modo desconhecido: ' + modo);
                }
            }
        }
    },
    // }}}
    // {{{ processaLista()
    /**
     * Adiciona os réus um a um
     *
     * @param? Array Réus
     */
    processaLista: function()
    {
        if (arguments.length) {
            this.reus = arguments[0];
            unsafeWindow.Bacen = this;
        }
        if (this.reus.length) {
            $('cpfCnpj').value = this.reus[0];
            this.reus.splice(0, 1);
            unsafeWindow.abreConsultarCpfCnpjPopUp();
        } else if ($F('idTipoAcao') && $F('idTipoAcao').value == '') {
            $F('idTipoAcao').focus();
        } else if ($F('valorUnico')) {
            $F('valorUnico').focus();
        }
    },
    // }}}
}
// }}}
// {{{ Execução
Bacen.init();
// }}}
// vim:enc=utf-8
