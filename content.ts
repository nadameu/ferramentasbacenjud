/**
 * Atalho para `document.getElementById()`
 */
function $<T extends HTMLElement>(id: string) {
	return document.getElementById(id) as T | null;
}

/**
 * Atalho para `document.getElementsByTagName()`
 */
function $$<T extends Element>(tag: string) {
	return document.getElementsByTagName(tag) as NodeListOf<T>;
}

/**
 * Atalho para `Array.from()`
 */
function $A<T>(group: ArrayLike<T>) {
	return Array.from(group);
}

/**
 * Retorna o primeiro resultado de `document.getElementsByName()`
 */
function $F<
	T extends HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>(name: string) {
	return document.getElementsByName(name)[0] as T | undefined;
}

/**
 * Retorna uma string com o número no formato português brasileiro
 */
function formatNumber(num: number) {
	return num.toLocaleString('pt-BR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		minimumIntegerDigits: 1,
		useGrouping: true,
	});
}

/**
 * Objeto principal do programa
 */
class Bacen {
	/**
	 * Método utilizado
	 */
	method: string = '';
	/**
	 * Página sendo exibida
	 */
	pagina: string;
	submit: boolean = false;
	valid: boolean = false;
	buscando: false | { valor: string } = false;

	/**
	 * Função inicial do programa
	 */
	constructor() {
		const url = new URL(location.href);
		this.pagina = url.pathname.split('/bacenjud2/')[1].split('.')[0];
		const parametros = url.searchParams;
		if (parametros.has('method')) {
			this.method = parametros.get('method') as string;
		}
		if (this.pagina in this && typeof (this as any)[this.pagina] === 'function') {
			const result = (this as any)[this.pagina](this.method);
			if (result instanceof Promise) {
				result.catch(err => console.error(err));
			}
		}
	}

	/**
	 * Menu Minutas -> Incluir Minuta de Bloqueio de Valores -> Conferir dados da Minuta
	 */
	conferirDadosMinutaBVInclusao(method: string) {
		if (method == 'conferirDados') {
			let erros;
			let msgErro = '';
			const senhaJuiz = $F('senhaJuiz');
			const btnIncluir = $F('btnIncluir');
			if ((erros = document.getElementsByClassName('msgErro')).length) {
				$A(erros).forEach(function(erro) {
					erro.innerHTML = erro.innerHTML
						.replace(/\n?•(\&nbsp;)?/g, '')
						.replace('<b>', '&ldquo;')
						.replace('</b>', '&rdquo;');
					msgErro += erro.textContent + '\n';
				});
				window.alert(msgErro);
				window.history.go(-1);
			} else if (senhaJuiz && !senhaJuiz.disabled) {
				senhaJuiz.focus();
			} else if (btnIncluir) {
				window.addEventListener(
					'keypress',
					function(e) {
						if (e.keyCode == 13) {
							e.preventDefault();
							e.stopPropagation();
							const evento = document.createEvent('MouseEvents');
							evento.initMouseEvent(
								'click',
								true,
								true,
								window,
								0,
								0,
								0,
								0,
								0,
								false,
								false,
								false,
								false,
								0,
								null
							);
							btnIncluir.dispatchEvent(evento);
						}
					},
					true
				);
			}
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Menu Minutas -> Incluir Minuta de Requisição de Informações -> Conferir dados da Minuta
	 */
	conferirDadosMinutaSIInclusao(method: string) {
		this.conferirDadosMinutaBVInclusao(method);
	}

	/**
	 * Janela pop-up aberta ao adicionar pessoa na tela de inclusão de minuta
	 * de requisição de informações
	 */
	consultarPessoa(method: string) {
		this.consultarReu(method);
	}

	/**
	 * Menu Ordens judiciais -> Consultar Ordens Judiciais por Juízo
	 */
	consultarSolicitacoesProtocoladasJuizo(method: string) {
		if (method == 'editarCriteriosConsultaPorVara') {
			const codigoVara = $F('codigoVara');
			if (codigoVara) {
				codigoVara.value = GM_getValue('vara');
			}
			const operador = $F('operador');
			if (operador) {
				operador.value = GM_getValue('juiz');
			}
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial
	 */
	consultarSolicitacoesProtocoladasProcesso(method: string) {
		if (method == 'editarCriteriosConsultaPorProcesso') {
			const numeroProcesso = $F('numeroProcesso');
			if (numeroProcesso) {
				numeroProcesso.focus();
				numeroProcesso.addEventListener(
					'change',
					() => this.onConsultaProcessoChange(numeroProcesso),
					true
				);
				numeroProcesso.addEventListener(
					'keypress',
					e => this.onProcessoKeypress(e as KeyboardEvent, numeroProcesso),
					true
				);
				document
					.getElementsByClassName('botao')[0]
					.addEventListener('click', e => this.onBotaoClick(e), true);
			}
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud
	 */
	consultarSolicitacoesProtocoladasProtocolo(method: string) {
		if (method == 'editarCriteriosConsultaPorProtocolo') {
			const numeroProtocolo = $F('numeroProtocolo');
			if (numeroProtocolo) {
				numeroProtocolo.focus();
				numeroProtocolo.addEventListener(
					'change',
					() => this.onConsultaProtocoloChange(numeroProtocolo),
					true
				);
				numeroProtocolo.addEventListener(
					'keypress',
					e => this.onProcessoKeypress(e as KeyboardEvent, numeroProtocolo),
					true
				);
				document
					.getElementsByClassName('botao')[0]
					.addEventListener('click', e => this.onBotaoClick(e), true);
			}
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Janela pop-up aberta ao adicionar réu
	 */
	consultarReu(method: string) {
		if (method == 'consultarReu') {
			window.addEventListener(
				'unload',
				() => {
					window.opener.setTimeout('processaLista();', 100);
				},
				true
			);
			window.addEventListener(
				'keypress',
				e => {
					if (e.keyCode == 27) {
						window.close();
					}
				},
				true
			);
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Menu Minutas -> Incluir Minuta de Bloqueio de Valores
	 */
	criarMinutaBVInclusao(method: string) {
		if (method == 'criar') {
			const cdOperadorJuiz = $F('cdOperadorJuiz');
			const codigoVara = $F('codigoVara');
			const processo = $F<HTMLInputElement>('processo');
			if (cdOperadorJuiz && cdOperadorJuiz.type != 'hidden') {
				cdOperadorJuiz.setAttribute('value', GM_getValue('juiz'));
			}
			if (codigoVara && processo) {
				codigoVara.setAttribute('value', GM_getValue('vara'));
				processo.select();
				processo.focus();
				processo.addEventListener('change', () => this.onProcessoChange(processo), true);
				processo.addEventListener('keypress', e => this.onProcessoKeypress(e, processo), true);
			}
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Menu Minutas -> Incluir Minuta de Requisição de Informações
	 */
	criarMinutaSIInclusao(method: string) {
		this.criarMinutaBVInclusao(method);
	}

	async dologin(_: string) {
		interface Info {
			campo: HTMLInputElement;
			preenchido: boolean;
		}
		async function obterCampo(nome: string) {
			const campo = $F(nome) as HTMLInputElement | undefined;
			if (campo) {
				return campo;
			}
			throw new Error(`Campo ${nome} não encontrado.`);
		}
		const campos = new Map(
			await Promise.all(
				['unidade', 'operador', 'senha'].map(nome =>
					obterCampo(nome).then(campo => [nome, campo] as [string, HTMLInputElement])
				)
			)
		);
		async function vincularCamposPreferencia(campo: HTMLInputElement, nomePref: string) {
			let preenchido = false;
			campo.addEventListener('change', () => {
				const promise =
					campo.value.trim() === ''
						? browser.storage.local.remove(nomePref)
						: browser.storage.local.set({ [nomePref]: campo.value });
				promise.catch(err => console.error(err));
			});
			const prefs = await browser.storage.local.get(nomePref);
			if (nomePref in prefs) {
				campo.value = prefs[nomePref];
				preenchido = true;
			}
			return { campo, preenchido } as Info;
		}
		const [unidade, operador, senha] = ['unidade', 'operador', 'senha'].map(
			nome => campos.get(nome) as HTMLInputElement
		);
		const informacoes = new Map(
			await Promise.all(
				[{ campo: unidade, pref: 'unidade' }, { campo: operador, pref: 'login' }].map(
					({ campo, pref }) =>
						vincularCamposPreferencia(campo, pref).then(info => [pref, info] as [string, Info])
				)
			)
		);
		const [infoUnidade, infoOperador] = ['unidade', 'login'].map(
			nome => informacoes.get(nome) as Info
		);
		function focarCampoVazio() {
			if (infoUnidade.preenchido) {
				if (infoOperador.preenchido) {
					senha.focus();
				} else {
					operador.focus();
				}
			} else {
				unidade.focus();
			}
		}
		window.addEventListener('load', focarCampoVazio, { once: true });
		browser.storage.onChanged.addListener((changes, areaName) => {
			if (areaName !== 'local') return;
			const changed = Object.keys(changes);
			changed.forEach(key => {
				if (informacoes.has(key)) {
					const info = informacoes.get(key) as Info;
					info.campo.value =
						((changes as any)[key] as browser.storage.StorageChange).newValue || '';
				}
			});
		});
	}

	/**
	 * Obtém informações do processo e preenche automaticamente os campos
	 */
	getInfo(numproc: string, modo: 'consulta' | 'preencher') {
		const estados = new Map([['70', 'PR'], ['71', 'RS'], ['72', 'SC']]);
		const estado = estados.get(GM_getValue('secao')) || 'SC';
		if (![10, 15, 20].includes(numproc.length)) {
			throw new Error('Número de processo inválido: ' + numproc);
		}
		const todas_partes = modo == 'preencher' ? 'S' : 'N';
		// WSDL: http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php
		const self = this;
		const options = {
			method: 'POST',
			url: 'http://www.trf4.jus.br/trf4/processos/acompanhamento/consultaws.php',
			data: `<?xml version="1.0" encoding="UTF-8"?>
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
			onload: function() {
				return self.preencher(this, modo);
			},
			headers: {
				SOAPAction: 'consulta_processual_ws_wsdl#ws_consulta_processo',
			},
		};
		GM_xmlhttpRequest(options);
	}

	/**
	 * Retorna o número do processo devidamente formatado
	 */
	getNumproc(input: string) {
		const secao = GM_getValue('secao');
		const subsecao = GM_getValue('subsecao');
		const ramo = '4';
		const tribunal = '04';
		let ano: number;
		let numero: string;
		const numproc = input.replace(/[^0-9\/]/g, '');
		if (/^(\d{2}|\d{4})\/\d{2,9}$/.test(numproc)) {
			const tmp = numproc.split('/');
			ano = Number(tmp[0]);
			if (ano < 50) {
				ano = Number(ano) + 2000;
			} else if (ano >= 50 && ano < 100) {
				ano = Number(ano) + 1900;
			}
			if (ano >= 2010) {
				numero = tmp[1].substr(0, tmp[1].length - 2);
			} else {
				numero = tmp[1].substr(0, tmp[1].length - 1);
			}
		} else if (numproc.match('/')) {
			return false;
		} else if ([10, 15, 20].includes(numproc.length)) {
			return numproc;
		} else {
			return false;
		}
		while (numero.length < 7) {
			numero = '0' + numero;
		}
		const r1 = Number(numero) % 97;
		const r2 = Number('' + r1 + ano + ramo + tribunal) % 97;
		const r3 = Number('' + r2 + secao + subsecao + '00') % 97;
		let dv = String(98 - r3);
		while (dv.length < 2) dv = '0' + dv;
		return [numero, dv, ano, ramo, tribunal, secao, subsecao].map(String).join('');
	}

	/**
	 * Retorna o número do protocolo
	 */
	getProtocolo(input: string) {
		let protocolo = input.replace(/[^0-9\/]/g, '');
		let ano: number;
		let numero: number;
		if (/^(\d{2}|\d{4})\/\d{1,10}$/.test(protocolo)) {
			const tmp = protocolo.split('/');
			ano = Number(tmp[0]);
			if (ano < 50) {
				ano = Number(ano) + 2000;
			} else if (ano >= 50 && ano < 100) {
				ano = Number(ano) + 1900;
			}
			numero = Number(tmp[1]);
		} else if (protocolo.match('/')) {
			return false;
		} else if (protocolo.length == 14) {
			return protocolo;
		} else if (protocolo.length >= 1 && protocolo.length <= 10) {
			ano = new Date().getFullYear();
			numero = Number(protocolo);
		} else {
			return false;
		}
		while (protocolo.length < 10) protocolo = '0' + protocolo;
		return `${ano}${protocolo}`;
	}

	/**
	 * Minuta conferida e incluída
	 */
	incluirMinutaBV(method: string) {
		if (method == 'incluir') {
			const fundosPadraoAClaro2 = document.getElementsByClassName(
				'fundoPadraoAClaro2'
			) as HTMLCollectionOf<HTMLTableElement>;
			if (fundosPadraoAClaro2.length) {
				const estaPagina = this.pagina;
				window.setTimeout(function() {
					if (
						window.confirm(
							(fundosPadraoAClaro2[0].rows[0].cells[0].textContent || '').split(/\n/)[2] +
								'\n\nDeseja incluir nova minuta?'
						)
					) {
						if (estaPagina == 'incluirMinutaBV') {
							window.location.href = 'criarMinutaBVInclusao.do?method=criar';
						} else if (estaPagina == 'incluirMinutaSI') {
							window.location.href = 'criarMinutaSIInclusao.do?method=criar';
						}
					}
				}, 0);
			}
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Minuta conferida e incluída
	 */
	incluirMinutaSI(method: string) {
		this.incluirMinutaBV(method);
	}

	/**
	 * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Botão "Consultar" -> Evento "click"
	 */
	onBotaoClick(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		this.submit = true;
		if (this.submit && this.valid && !this.buscando) {
			const numeroProcesso = $F('numeroProcesso');
			const numeroProtocolo = $F('numeroProtocolo');
			if (numeroProcesso) {
				numeroProcesso.select();
				numeroProcesso.focus();
			} else if (numeroProtocolo) {
				numeroProtocolo.select();
				numeroProtocolo.focus();
			}
			$$('form')[0].submit();
		}
	}

	/**
	 * Função que atende ao evento change do Número do Processo
	 */
	onConsultaProcessoChange(input) {
		const valor = input.value.toString();
		const numproc = this.getNumproc(valor);
		if (valor) {
			if (valor.match('/') && numproc) {
				input.value = 'Carregando...';
				this.buscando = {
					valor: valor,
				};
				this.getInfo(numproc, 'consulta');
			} else if (numproc) {
				input.value = numproc;
				this.valid = true;
			} else {
				this.valid = false;
				window.alert('Número de processo inválido: "' + valor + '".');
				window.setTimeout(function() {
					input.value = valor;
					input.select();
					input.focus();
				}, 100);
			}
		}
	}

	/**
	 * Função que atende ao evento change do Número do Protocolo
	 */
	onConsultaProtocoloChange(input) {
		const valor = input.value.toString();
		const protocolo = this.getProtocolo(valor);
		if (valor && protocolo) {
			input.value = protocolo;
			this.valid = true;
		} else if (valor) {
			this.valid = false;
			window.alert('Número de protocolo inválido: "' + valor + '".');
			window.setTimeout(function() {
				input.select();
				input.focus();
			}, 100);
		}
	}

	/**
	 * Função que atende ao evento change do Número do Processo
	 */
	onProcessoChange(input) {
		const valor = input.value.toString();
		$$('form')[0].reset();
		const reus = $A($F('reus').getElementsByTagName('option'));
		reus.forEach(function(reu) {
			reu.selected = true;
		});
		if (reus.length) {
			if (this.pagina == 'criarMinutaBVInclusao') {
				window.wrappedJSObject.excluirReu();
			} else if (this.pagina == 'criarMinutaSIInclusao') {
				window.wrappedJSObject.excluirPessoa();
			}
		}
		if (valor) {
			input.value = 'Carregando...';
			const numproc = this.getNumproc(valor);
			if (numproc) {
				this.buscando = {
					valor: valor,
				};
				this.getInfo(numproc, 'preencher');
			} else {
				window.alert('Número de processo inválido: "' + valor + '".');
				window.setTimeout(function() {
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
	onProcessoKeypress(e: KeyboardEvent, input) {
		if (e.keyCode == 9 || e.keyCode == 13) {
			e.preventDefault();
			e.stopPropagation();
			if (input.name == 'processo') {
				$F('idTipoAcao').focus();
			} else if (input.name == 'numeroProcesso' || input.name == 'numeroProtocolo') {
				this.submit = e.keyCode == 13 ? true : false;
				document.getElementsByClassName('botao')[0].focus();
				if (this.submit && this.valid && !this.buscando) {
					input.select();
					input.focus();
					$$('form')[0].submit();
				}
			}
		}
	}

	/**
	 * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Consultar
	 *
	 * @param String Método utilizado pela página
	 */
	pesquisarPorProcesso(method: string) {
		if (method == 'pesquisarPorProcesso') {
			let erros;
			let msgErro = '';
			if ((erros = document.getElementsByClassName('msgErro')).length) {
				$A(erros).forEach(function(erro) {
					erro.innerHTML = erro.innerHTML
						.replace(/\n?•(\&nbsp;)?/g, '')
						.replace('<b>', '&ldquo;')
						.replace('</b>', '&rdquo;');
					msgErro += erro.textContent + '\n';
				});
				window.alert(msgErro);
				history.go(-1);
			} else if (document.getElementsByClassName('pagebanner').length) {
				const registros = document
					.getElementsByClassName('pagebanner')[0]
					.textContent.match(/^\d+/);
				if (registros == 1) {
					window.location.href = document
						.getElementById('ordem')
						.rows[1].cells[3].getElementsByTagName('a')[0].href;
				}
			}
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud -> Consultar
	 */
	pesquisarPorProtocolo(method: string) {
		if (method == 'pesquisarPorProtocolo') {
			let erros;
			let msgErro = '';
			if ((erros = document.getElementsByClassName('msgErro')).length) {
				$A(erros).forEach(function(erro) {
					erro.innerHTML = erro.innerHTML
						.replace(/\n?•(\&nbsp;)?/g, '')
						.replace('<b>', '&ldquo;')
						.replace('</b>', '&rdquo;');
					msgErro += erro.textContent + '\n';
				});
				window.alert(msgErro);
				history.go(-1);
			}
		} else {
			throw new Error('Método desconhecido: ' + method);
		}
	}

	/**
	 * Preenche os campos com as informações obtidas
	 *
	 * @param GM_xmlhttpRequest Objeto retornado
	 * @param String Modo de preenchimento
	 * @param Object Opções passadas ao objeto
	 */
	preencher(obj, modo: 'preencher' | 'consulta') {
		if (modo != 'preencher' && modo != 'consulta') {
			throw new Error('Modo inválido: ' + modo);
		}
		const parser = new DOMParser();
		const ret = parser.parseFromString(obj.responseText, 'text/xml').querySelector('return')
			.textContent;
		const processo = parser.parseFromString(ret, 'text/xml');
		const erros: string[] = [];
		Array.prototype.slice.call(processo.querySelectorAll('Erro')).forEach(function(erro) {
			erros.push(erro.textContent);
		});
		const el = modo == 'preencher' ? 'processo' : 'numeroProcesso';
		const campoProcesso = $F(el);
		if (campoProcesso) {
			if (erros.length) {
				this.valid = false;
				window.alert(erros.join('\n'));
				campoProcesso.value = this.buscando.valor;
				this.buscando = false;
				campoProcesso.select();
				campoProcesso.focus();
			} else {
				this.valid = true;
				this.buscando = false;
				campoProcesso.value = processo
					.querySelector('Processo Processo')
					.textContent.replace(/[^0-9]/g, '');
				if (modo == 'preencher') {
					if (
						processo.querySelector('CodClasse').textContent == '000229' ||
						processo.querySelector('CodClasse').textContent == '000098'
					) {
						$F('idTipoAcao').value = 1;
					} else if (processo.querySelector('CodClasse').textContent == '000099') {
						$F('idTipoAcao').value = 4;
					}
					if ($F('valorUnico') && processo.querySelector('ValCausa')) {
						const valorCausa = Number(processo.querySelector('ValCausa').textContent);
						if (!isNaN(valorCausa)) {
							$F('valorUnico').value = formatNumber(valorCausa);
						}
					}
					const reus = [];
					Array.prototype.slice
						.call(processo.querySelectorAll('Partes Parte'))
						.forEach(function(parte) {
							if (
								parte.querySelectorAll('Autor').length &&
								parte.querySelector('Autor').textContent == 'S'
							) {
								$F('nomeAutor').value = parte.querySelector('Nome').textContent;
								$F('cpfCnpjAutor').value = parte.querySelector('CPF_CGC').textContent;
							} else if (
								(parte.querySelectorAll('Réu').length &&
									parte.querySelector('Réu').textContent == 'S') ||
								(parte.querySelectorAll('Reu').length &&
									parte.querySelector('Reu').textContent == 'S')
							) {
								reus.push(parte.querySelector('CPF_CGC').textContent);
							}
						});
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
	}

	/**
	 * Adiciona os réus um a um
	 */
	processaLista() {
		if (arguments.length) {
			this.reus = arguments[0];
			window.wrappedJSObject.processaLista = function() {
				Bacen.processaLista.apply(Bacen, []);
			};
		}
		if (this.reus.length) {
			const documento = this.reus[0].toString();
			this.reus.splice(0, 1);
			$('cpfCnpj').value = documento;
			$('botaoIncluirCpfCnpj').disabled = false;
			$('botaoIncluirCpfCnpj').focus();
			(function(window) {
				const evento = document.createEvent('MouseEvents');
				evento.initMouseEvent(
					'click',
					true,
					true,
					window,
					0,
					0,
					0,
					0,
					0,
					false,
					false,
					false,
					false,
					0,
					null
				);
				$('botaoIncluirCpfCnpj').dispatchEvent(evento);
			})(window.wrappedJSObject);
		} else if ($F('idTipoAcao') && $F('idTipoAcao').value == '') {
			$F('idTipoAcao').focus();
		} else if ($F('valorUnico')) {
			$F('valorUnico').select();
			$F('valorUnico').focus();
		}
	}
}

new Bacen();
