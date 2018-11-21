async function main() {
	const preferencias = await carregarPreferencias();
	await whenDocumentInteractive();
	analisarPagina(preferencias);
}

// Interfaces

interface Apply<A> {
	ap<B>(that: Apply<(_: A) => B>): Apply<B>;
	map<B>(f: (_: A) => B): Apply<B>;
}
interface Applicative {
	of<A>(value: A): Apply<A>;
}

// Classes

const enum KeyCode {
	ENTER = 13,
	ESCAPE = 27,
}

class Maybe<A> {
	constructor(readonly fold: <B>(Nothing: () => B, Just: (value: A) => B) => B) {}

	ap<B>(that: Maybe<(_: A) => B>): Maybe<B> {
		return that.chain(f => this.map(f));
	}
	chain<B>(f: (_: A) => Maybe<B>): Maybe<B> {
		return this.fold(() => Nothing, f);
	}
	filter<B extends A>(p: (value: A) => value is B): Maybe<B>;
	filter(p: (_: A) => boolean): Maybe<A>;
	filter(p: (_: A) => boolean): Maybe<A> {
		return this.fold(() => Nothing, x => (p(x) ? Just(x) : Nothing));
	}
	ifJust(f: (_: A) => void): void {
		this.fold(() => {}, f);
	}
	ifNothing(f: () => void): void {
		this.fold(f, () => {});
	}
	isJust(): boolean {
		return this.fold(() => false, () => true);
	}
	isNothing(): boolean {
		return this.fold(() => true, () => false);
	}
	map<B>(f: (_: A) => B): Maybe<B> {
		return this.chain(x => Just(f(x)));
	}
	mapNullable<B>(f: (_: A) => B | null | undefined): Maybe<B> {
		return this.chain(x => Maybe.fromNullable(f(x)));
	}
	getOrElse(defaultValue: A): A {
		return this.fold(() => defaultValue, x => x);
	}

	static fromNullable<A>(value: A | null | undefined): Maybe<A> {
		return value == null ? Nothing : Just(value);
	}
	static of<A>(value: A): Maybe<A> {
		return new Maybe((_, J) => J(value));
	}
	static zero<A = never>(): Maybe<A> {
		return new Maybe((N, _) => N());
	}
}
function Just<A>(value: A): Maybe<A> {
	return Maybe.of(value);
}
const Nothing = Maybe.zero();

class Task<E, A> {
	constructor(
		private readonly _fork: (rej: (_: E) => void, res: (_: A) => void) => void | (() => void)
	) {}

	alt(that: Task<E, A>): Task<E, A> {
		return new Task((rej, res) => {
			let done = false;
			let cancelThat: () => void = () => {};
			const cancelThis = this.fork(
				guard((e: E) => {
					cancelThat();
					rej(e);
				}),
				guard((x: A) => {
					cancelThat();
					res(x);
				})
			);
			if (done) return;
			cancelThat = that.fork(
				guard((e: E) => {
					cancelThis();
					rej(e);
				}),
				guard((x: A) => {
					cancelThis();
					res(x);
				})
			);
			return guard(() => {
				cancelThis();
				cancelThat();
			});

			function guard(f: () => void): () => void;
			function guard<T>(f: (_: T) => void): (_: T) => void;
			function guard<T>(f: (_: T) => void): (_: T) => void {
				return x => {
					if (done) return;
					done = true;
					f(x);
				};
			}
		});
	}
	chain<B>(f: (_: A) => Task<E, B>): Task<E, B> {
		return new Task((rej, res) => {
			let cancelInner: () => void = () => {};
			const cancel = this.fork(rej, x => {
				cancelInner = f(x).fork(rej, res);
			});
			return () => {
				cancelInner();
				cancel();
			};
		});
	}
	chainLeft<B>(f: (_: E) => Task<B, A>): Task<B, A> {
		return new Task((rej, res) => {
			let cancelInner: () => void = () => {};
			const cancel = this.fork(e => {
				cancelInner = f(e).fork(rej, res);
			}, res);
			return () => {
				cancelInner();
				cancel();
			};
		});
	}
	fork(whenRejected: (reason: E) => void, whenResolved: (value: A) => void): () => void {
		let done = false;
		const cancel = this._fork(guard(whenRejected), guard(whenResolved)) || (() => {});

		return guard(cancel);

		function guard(f: () => void): () => void;
		function guard<T>(f: (_: T) => void): (_: T) => void;
		function guard(f: Function) {
			return (x: any) => {
				if (done) return;
				done = true;
				f(x);
			};
		}
	}
	map<B>(f: (_: A) => B): Task<E, B> {
		return new Task((rej, res) => this.fork(rej, (x: A) => res(f(x))));
	}

	static of<A, E = never>(value: A): Task<E, A> {
		return new Task((_, res) => res(value));
	}
	static rejected<E, A = never>(reason: E): Task<E, A> {
		return new Task(rej => rej(reason));
	}
}

class Validation<A> {
	constructor(readonly fold: <B>(Failure: (_: string[]) => B, Success: (_: A) => B) => B) {}
	ap<B>(that: Validation<(_: A) => B>): Validation<B> {
		return that.fold(
			thoseErrors =>
				Failure(this.fold(theseErrors => thoseErrors.concat(theseErrors), () => thoseErrors)),
			f => this.map(f)
		);
	}
	chain<B>(f: (_: A) => Validation<B>): Validation<B> {
		return this.fold(Failure, f);
	}
	map<B>(f: (_: A) => B): Validation<B> {
		return this.fold(Failure, x => Success(f(x)));
	}
	toMaybe(): Maybe<A> {
		return new Maybe((Nothing, Just) => this.fold(Nothing, Just));
	}
	toTask(): Task<string[], A> {
		return new Task((rej, res) => this.fold(rej, res));
	}

	static fail<A = never>(error: string): Validation<A> {
		return Failure([error]);
	}
	static of<A>(value: A): Validation<A> {
		return Success(value);
	}
}
function Failure<A = never>(errors: string[]): Validation<A> {
	return new Validation((F, _) => F(errors));
}
function Success<A>(value: A): Validation<A> {
	return new Validation((_, S) => S(value));
}

// Funções

function adicionarCheckboxLembrar(preferencias: PreferenciasObject) {
	const template = document.createElement('template');
	template.innerHTML = `<label> <input type="checkbox"> Lembrar</label><br>`;
	return function(input: HTMLInputElement, preferencia: Preferencias) {
		const fragment = document.importNode(template.content, true);
		const checkbox = fragment.querySelector('input') as HTMLInputElement;
		checkbox.checked = preferencias.get(preferencia).isJust();
		checkbox.addEventListener('change', salvarPreferencia);
		input.addEventListener('change', salvarPreferencia);
		let next = input.nextSibling;
		if (next && next.nodeType === Node.TEXT_NODE && (next.textContent || '').match(/^\s*$/)) {
			const empty = next;
			next = next.nextSibling;
			(empty.parentNode as Node).removeChild(empty);
		}
		(input.parentNode as Node).insertBefore(fragment, input.nextSibling);
		return salvarPreferencia;

		function salvarPreferencia() {
			(checkbox.checked && input.value
				? preferencias.set(preferencia, input.value)
				: preferencias.remove(preferencia)
			).catch(error => {
				console.error(error);
			});
		}
	};
}

function analisarPagina(preferencias: PreferenciasObject) {
	const url = new URL(location.href);
	const pagina = url.pathname.split('/bacenjud2/')[1].split('.')[0];
	const acao = Paginas.get(pagina);
	if (acao) {
		try {
			const result = acao(preferencias, pagina);
			result.fold(
				errors => {
					console.log('Erro(s) encontrado(s):', errors);
				},
				() => {}
			);
		} catch (error) {
			console.error(error);
		}
	} else {
		console.log('Página desconhecida:', pagina);
	}
}

interface PreferenciasObject {
	get(name: Preferencias): Maybe<string>;
	set(name: Preferencias, value: string): Promise<void>;
	remove(name: Preferencias): Promise<void>;
}
const enum Preferencias {
	ASSESSOR = 'assessor',
	JUIZ = 'juiz',
	INVERTER = 'inverter',
	OPERADOR = 'operador',
	ORIGEM = 'origem',
	UNIDADE = 'unidade',
	VARA = 'vara',
}
async function carregarPreferencias(): Promise<PreferenciasObject> {
	const preferencias = new Map<Preferencias, string>(
		await browser.storage.local
			.get()
			.then(prefs => Object.entries(prefs) as [Preferencias, string][])
	);

	const listeners = new Map<Preferencias, ((_: Maybe<string>) => void)[]>();
	browser.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== 'local') return;
		const changedKeys = Object.keys(changes) as Preferencias[];
		changedKeys.forEach(key => {
			const result = (changes as any)[key] as browser.storage.StorageChange;
			if ('newValue' in result && typeof result.newValue === 'string') {
				preferencias.set(key, result.newValue);
			} else {
				preferencias.delete(key);
			}
			(listeners.get(key) || []).forEach(listener =>
				listener(Maybe.fromNullable(preferencias.get(key)))
			);
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

function conferirDadosMinutaInclusao(preferencias: PreferenciasObject): Validation<void> {
	if (queryAll('.msgErro').length > 0) {
		return criarMinutaInclusao(preferencias);
	}
	return query<HTMLFormElement>('form')
		.chain(form =>
			sequenceAO(Validation, {
				senhaJuiz: queryInput('senhaJuiz', form),
				btnIncluir: queryInput('btnIncluir', form),
			})
		)
		.map(({ senhaJuiz, btnIncluir }) => {
			if (!senhaJuiz.disabled) {
				senhaJuiz.focus();
			} else {
				window.addEventListener('keypress', e => {
					if (e.keyCode !== KeyCode.ENTER) return;
					e.preventDefault();
					btnIncluir.click();
				});
			}
		});
}

function consultarPessoa(_: PreferenciasObject): Validation<void> {
	window.addEventListener('keyup', evt => {
		if (evt.keyCode === KeyCode.ESCAPE) {
			opener.focus();
			window.close();
		}
	});
	window.addEventListener('unload', () => {
		opener.postMessage({ acao: 'incluirReu' }, location.origin);
	});
	return Success(undefined);
}

function consultarPorAssessor(preferencias: PreferenciasObject): Validation<void> {
	return query<HTMLFormElement>('form')
		.chain(form =>
			sequenceAO(Validation, {
				juiz: queryInput('cdOperadorJuiz', form),
				assessor: queryInput('cdOperadorAssessor', form),
				dataInicial: queryInput('dataInicial', form),
				dataFinal: queryInput('dataFinal', form),
			})
		)
		.map(({ juiz, assessor, dataInicial, dataFinal }) => {
			[dataInicial, dataFinal].forEach(input => {
				input.required = true;
			});

			const preencherSeVazio = preencherSeVazioFactory(preferencias);
			preencherSeVazio(juiz, Preferencias.JUIZ);
			preencherSeVazio(assessor, Preferencias.ASSESSOR);

			const adicionar = adicionarCheckboxLembrar(preferencias);
			adicionar(juiz, Preferencias.JUIZ);
			adicionar(assessor, Preferencias.ASSESSOR);

			focarSeVazio([juiz, assessor, dataInicial, dataFinal]);
		});
}

function consultarPorJuizo(preferencias: PreferenciasObject): Validation<void> {
	return query<HTMLFormElement>('form')
		.chain(form =>
			sequenceAO(Validation, {
				idVara: querySelect('idVara', form),
				vara: queryInput('codigoVara', form),
				juiz: queryInput('operador', form),
				dataInicial: queryInput('dataInicial', form),
				dataFinal: queryInput('dataFinal', form),
			})
		)
		.map(({ idVara, vara, juiz, dataInicial, dataFinal }) => {
			[vara, dataInicial, dataFinal].forEach(input => {
				input.required = true;
			});

			const preencherSeVazio = preencherSeVazioFactory(preferencias);
			preencherSeVazio(vara, Preferencias.VARA);
			preencherSeVazio(juiz, Preferencias.JUIZ);

			const adicionar = adicionarCheckboxLembrar(preferencias);
			const salvarVara = adicionar(vara, Preferencias.VARA);
			adicionar(juiz, Preferencias.JUIZ);

			const sincronizar = () => sincronizarSelectInput(idVara, vara, salvarVara);
			idVara.addEventListener('change', sincronizar);
			sincronizar();

			focarSeVazio([vara, juiz]);
		});
}

function consultarPorProcesso(_: PreferenciasObject): Validation<void> {
	return query<HTMLFormElement>('form')
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

function consultarPorProtocolo(_: PreferenciasObject): Validation<void> {
	return query<HTMLFormElement>('form')
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

function criarMinutaInclusao(preferencias: PreferenciasObject): Validation<void> {
	return query<HTMLFormElement>('form')
		.chain(form =>
			sequenceAO(Validation, {
				form: Success(form),
				juiz: queryInput('cdOperadorJuiz', form),
				idVara: querySelect('idVara', form),
				vara: queryInput('codigoVara', form),
				processo: queryInput('processo', form),
				tipo: querySelect('idTipoAcao', form),
				nomeAutor: queryInput('nomeAutor', form),
				docAutor: queryInput('cpfCnpjAutor', form),
				docReu: query<HTMLInputElement>('input#cpfCnpj'),
				reus: querySelect('reus', form),
				maybeValor: Success(queryInput('valorUnico', form).toMaybe()),
			})
		)
		.map(elementos => {
			const {
				form,
				juiz,
				idVara,
				vara,
				processo,
				tipo,
				nomeAutor,
				docAutor,
				docReu,
				reus,
				maybeValor,
			} = elementos;

			[juiz, vara, processo, tipo, nomeAutor]
				.concat(maybeValor.fold(() => [], x => [x]))
				.forEach(campo => {
					campo.required = true;
				});

			const adicionar = adicionarCheckboxLembrar(preferencias);
			if (juiz.type !== 'hidden') {
				adicionar(juiz, Preferencias.JUIZ);
			}
			const salvarVara = adicionar(vara, Preferencias.VARA);

			const sincronizar = () => sincronizarSelectInput(idVara, vara, salvarVara);
			idVara.addEventListener('change', sincronizar);
			sincronizar();

			const preencherSeVazio = preencherSeVazioFactory(preferencias);
			preencherSeVazio(juiz, Preferencias.JUIZ);
			preencherSeVazio(vara, Preferencias.VARA);

			const { linha: trOrigem, select: origem } = criarLinhaSelect(
				'Origem',
				'Selecione a origem do processo',
				{ TRF: 'TRF4', PR: 'JFPR', RS: 'JFRS', SC: 'JFSC' },
				Preferencias.ORIGEM
			);
			const { linha: trInverter, select: inverter } = criarLinhaSelect(
				'Inverter autor/réu',
				'Informe se o exequente se encontra no polo passivo do processo',
				{ S: 'Sim', N: 'Não' },
				Preferencias.INVERTER
			);
			const trProcesso = Maybe.fromNullable(processo.closest('tr'));
			trProcesso.ifJust(tr => {
				const parent = tr.parentNode as Node;
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
			const blocking = document.importNode(template.content, true).firstChild as HTMLDivElement;
			document.body.appendChild(blocking);

			const templateBotaoBuscar = document.createElement('template');
			templateBotaoBuscar.innerHTML = `&nbsp;<input type="button" class="botao" value="Buscar dados do processo">`;
			const fragBuscar = document.importNode(templateBotaoBuscar.content, true);
			const botaoBuscar = fragBuscar.querySelector('input') as HTMLInputElement;
			botaoBuscar.addEventListener('click', buscarDados);
			(processo.parentNode as Node).insertBefore(fragBuscar, processo.nextSibling);

			let buscando = false;
			let tentativaBuscarDados = false;
			processo.addEventListener('change', buscarDados);

			form.addEventListener('submit', evt => {
				if (buscando) {
					evt.preventDefault();
				}
			});

			function buscarDados() {
				if (buscando) return;
				if ([origem, inverter, processo].find(input => !input.validity.valid)) {
					tentativaBuscarDados = true;
					form.reportValidity();
					return;
				}
				tentativaBuscarDados = false;
				buscando = true;
				blocking.style.display = 'grid';
				const inverterPolos = inverter.value === 'S';
				preencherDados(
					{ numproc: processo.value, codClasse: '', valCausa: Nothing, autores: [], reus: [] },
					inverterPolos
				);

				const TIMEOUT = 10000; // milissegundos
				obterDadosProcesso(processo.value, origem.value as any)
					.alt(
						new Task(rej => {
							const timer = setTimeout(
								() => rej(['Conexão demorou demais para responder.']),
								TIMEOUT
							);
							return () => clearTimeout(timer);
						})
					)
					.map(({ numproc, ...info }) => {
						preencherDados({ numproc: numproc.replace(/\D/g, ''), ...info }, inverterPolos);
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
					.fork(() => {}, () => {});
			}

			function criarLinhaSelect(
				label: string,
				title: string,
				options: { [key: string]: string },
				preferencia: Preferencias
			) {
				const template = document.createElement('template');
				template.innerHTML = `<tr class="fundoPadraoAClaro2">
	<td class="nomeCampo">* ${label}:</td>
	<td>
		<select title="${title}" required><option value=""></option>${Object.keys(options).map(
					key => `<option value="${key}">${options[key]}</option>`
				)}</select>
	</td>
</tr>`;
				const linha = document.importNode(template.content, true);
				const select = linha.querySelector('select') as HTMLSelectElement;
				select.value = preferencias.get(preferencia).getOrElse('');
				select.addEventListener('change', () => {
					Maybe.of(select.value)
						.filter(x => x !== '')
						.fold(
							() => preferencias.remove(preferencia),
							value => {
								if (tentativaBuscarDados) {
									buscarDados();
								}
								return preferencias.set(preferencia, value);
							}
						)
						.catch(error => console.error(error));
				});
				return { linha, select };
			}

			function preencherDados(dados: InfoProcesso, inverter: boolean) {
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
						.map(val =>
							val.toLocaleString('pt-BR', {
								style: 'decimal',
								minimumIntegerDigits: 1,
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
								useGrouping: true,
							})
						)
						.getOrElse('');
				});

				if (reus.options.length > 0) {
					Array.from(reus.options).forEach(option => {
						option.selected = true;
					});
					if (reus.title.match(/réu/)) {
						window.wrappedJSObject.excluirReu();
					} else {
						window.wrappedJSObject.excluirPessoa();
					}
				}

				const infoReus = inverter ? dados.autores : dados.reus;
				const docsReus = infoReus.reduce(
					(xs, { documento: mx }) => mx.fold(() => xs, x => (xs.push(x), xs)),
					[] as string[]
				);
				if (docsReus.length > 0) {
					window.addEventListener('message', onMessage);
					incluirReu();
				}

				function incluirReu() {
					if (docsReus.length === 0) {
						window.removeEventListener('message', onMessage);
						return;
					}
					const reu = docsReus.shift() as string;
					docReu.value = reu;
					window.wrappedJSObject.abreConsultarCpfCnpjPopUp();
				}

				function onMessage(evt: MessageEvent) {
					if (evt.origin !== location.origin) return;
					if ('acao' in evt.data && evt.data.acao === 'incluirReu') {
						incluirReu();
					}
				}
			}
		});
}

function dologin(preferencias: PreferenciasObject): Validation<void> {
	return query<HTMLFormElement>('form')
		.chain(form =>
			sequenceAO(Validation, {
				form: Success(form),
				opcoesLogin: queryRadio('opcao_login', form),
				unidade: queryInput('unidade', form),
				operador: queryInput('operador', form),
				senha: queryInput('senha', form),
				cpf: queryInput('cpf', form),
			})
		)
		.map(elementos => {
			const { form, opcoesLogin, unidade, operador, senha, cpf } = elementos;

			const exigirCampos = exigirCamposFactory(
				[unidade, operador, senha, cpf].concat(
					queryAll('input[name="senhanova"], input[name="senhanova2"]', form)
				)
			);

			exigirCampos(true);
			queryMaybe('input[name="cancelar_troca"]').ifJust(botao => {
				botao.addEventListener('click', () => exigirCampos(false));
			});

			const adicionar = adicionarCheckboxLembrar(preferencias);
			adicionar(unidade, Preferencias.UNIDADE);
			adicionar(operador, Preferencias.OPERADOR);

			opcoesLogin.forEach(opcao => {
				opcao.addEventListener('click', verificarFoco);
			});
			window.addEventListener('load', verificarFoco);
			if (document.readyState === 'complete') verificarFoco();

			const preencherSeVazio = preencherSeVazioFactory(preferencias);
			function preencher() {
				preencherSeVazio(unidade, Preferencias.UNIDADE);
				preencherSeVazio(operador, Preferencias.OPERADOR);
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

	function exigirCamposFactory(campos: HTMLInputElement[]) {
		return function exigirCampos(requerido: boolean) {
			campos.forEach(campo => {
				campo.required = requerido;
			});
		};
	}
}

function focarSeVazio(inputs: (HTMLInputElement | HTMLSelectElement)[]): boolean {
	for (const input of inputs) {
		if (!input.disabled && input.value === '') {
			input.focus();
			return true;
		}
	}
	return false;
}

function liftA2<A, B, C>(vx: Validation<A>, vy: Validation<B>, f: (x: A, y: B) => C): Validation<C>;
function liftA2<A, B, C>(mx: Maybe<A>, my: Maybe<B>, f: (x: A, y: B) => C): Maybe<C>;
function liftA2<A, B, C>(ax: Apply<A>, ay: Apply<B>, f: (x: A, y: B) => C): Apply<C> {
	return ay.ap(ax.map((x: A) => (y: B) => f(x, y)));
}

function liftA3<A, B, C, D>(
	vx: Validation<A>,
	vy: Validation<B>,
	vz: Validation<C>,
	f: (x: A, y: B, z: C) => D
): Validation<D>;
function liftA3<A, B, C, D>(
	mx: Maybe<A>,
	my: Maybe<B>,
	mz: Maybe<C>,
	f: (x: A, y: B, z: C) => D
): Maybe<D>;
function liftA3<A, B, C, D>(
	ax: Apply<A>,
	ay: Apply<B>,
	az: Apply<C>,
	f: (x: A, y: B, z: C) => D
): Apply<D> {
	return az.ap(ay.ap(ax.map((x: A) => (y: B) => (z: C) => f(x, y, z))));
}

function liftA4<A, B, C, D, E>(
	vw: Validation<A>,
	vx: Validation<B>,
	vy: Validation<C>,
	vz: Validation<D>,
	f: (w: A, x: B, y: C, z: D) => E
): Validation<E>;
function liftA4<A, B, C, D, E>(
	aw: Apply<A>,
	ax: Apply<B>,
	ay: Apply<C>,
	az: Apply<D>,
	f: (w: A, x: B, y: C, z: D) => E
): Apply<E> {
	return az.ap(ay.ap(ax.ap(aw.map((w: A) => (x: B) => (y: C) => (z: D) => f(w, x, y, z)))));
}

function incluirMinuta(tipoMinuta: 'BV' | 'SI'): Validation<void> {
	const paginaInclusao = `criarMinuta${tipoMinuta}Inclusao.do?method=criar`;
	const selector = 'table.fundoPadraoAClaro2 > tbody > tr:first-child > td:first-child';
	return queryMaybe<HTMLTableCellElement>(selector)
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
		.fold(
			() => Validation.fail(`Não foi possível obter o resultado da inclusão.`),
			() => Validation.of(undefined)
		);
}

function incluirMinutaBV(_: PreferenciasObject): Validation<void> {
	return incluirMinuta('BV');
}

function incluirMinutaSI(_: PreferenciasObject): Validation<void> {
	return incluirMinuta('SI');
}

interface InfoParte {
	nome: string;
	documento: Maybe<string>;
}
interface InfoPartes {
	autores: InfoParte[];
	reus: InfoParte[];
}
interface InfoProcesso extends InfoPartes {
	numproc: string;
	codClasse: string;
	valCausa: Maybe<number>;
}
function obterDadosProcesso(
	numproc: string,
	estado: 'PR' | 'RS' | 'SC' | 'TRF4'
): Task<string[], InfoProcesso> {
	return new Task<any, XMLDocument>((rej, res) => {
		// WSDL: http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php
		const xhr = new XMLHttpRequest();
		xhr.addEventListener('load', () => res(xhr.responseXML as XMLDocument));
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
				.map(ret => parser.parseFromString(ret, 'text/xml') as XMLDocument)
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

			const { autores, reus } = queryAll('Partes Parte', processo).reduce(
				(partes, parte) => {
					const ehAutor = obterTexto('Autor', parte, 'N') === 'S';
					const ehReu = obterTexto('Réu, Reu', parte, 'N') === 'S';
					if (ehAutor === ehReu) return partes;
					const nome = obterTexto('Nome', parte);
					const documento = obterTexto('CPF_CGC', parte);
					return nome
						.map(
							nome => ((ehAutor ? partes.autores : partes.reus).push({ nome, documento }), partes)
						)
						.getOrElse(partes);
				},
				{ autores: [], reus: [] } as InfoPartes
			);
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

	function obterTexto(selector: string, context: NodeSelector): Maybe<string>;
	function obterTexto(selector: string, context: NodeSelector, defaultValue: string): string;
	function obterTexto(selector: string, context: NodeSelector, defaultValue?: string) {
		const maybe = queryMaybe(selector, context)
			.mapNullable(x => x.textContent)
			.filter(x => x.trim() !== '');
		return defaultValue === undefined ? maybe : maybe.getOrElse(defaultValue);
	}
}

function preencherSeVazioFactory(
	preferencias: PreferenciasObject
): (input: HTMLInputElement, preferencia: Preferencias) => void {
	return (input, preferencia) => {
		preferencias.get(preferencia).ifJust(value => {
			if (input.value === '') {
				input.value = value;
			}
		});
	};
}

function queryAll<T extends Element>(selector: string, context: NodeSelector = document): T[] {
	return Array.from(context.querySelectorAll<T>(selector));
}

function queryCampo<T extends Element | RadioNodeList>(
	nome: string,
	form: HTMLFormElement
): Validation<T> {
	return new Validation((Failure, Success) => {
		const elt = form.elements.namedItem(nome) as T | null;
		return elt === null ? Failure([`Campo não encontrado: "${nome}".`]) : Success(elt);
	});
}

function queryRadio(nome: string, form: HTMLFormElement): Validation<RadioNodeList> {
	return queryCampo<RadioNodeList>(nome, form);
}

function queryInput(nome: string, form: HTMLFormElement): Validation<HTMLInputElement> {
	return queryCampo<HTMLInputElement>(nome, form);
}

function querySelect(nome: string, form: HTMLFormElement): Validation<HTMLSelectElement> {
	return queryCampo<HTMLSelectElement>(nome, form);
}

function queryMaybe<T extends Element>(
	selector: string,
	context: NodeSelector = document
): Maybe<T> {
	return new Maybe((Nothing, Just) => {
		const elt = context.querySelector<T>(selector);
		return elt === null ? Nothing() : Just(elt);
	});
}

function query<T extends Element>(
	selector: string,
	context: NodeSelector = document
): Validation<T> {
	return new Validation((Failure, Success) => {
		const elt = context.querySelector<T>(selector);
		return elt === null ? Failure([`Elemento não encontrado: '${selector}'.`]) : Success(elt);
	});
}

interface Matches {
	Validation: typeof Validation;
	Maybe: typeof Maybe;
}
type GetMatch<A> = { [k in keyof Matches]: A extends Matches[k] ? k : never }[keyof Matches];
type Fallback<T> = T extends never ? 'Applicative' : T;
interface SequenceAOResults<O> {
	Applicative: Apply<{ [k in keyof O]: O[k] extends Apply<infer T> ? T : never }>;
	Validation: Validation<{ [k in keyof O]: O[k] extends Validation<infer T> ? T : never }>;
	Maybe: Maybe<{ [k in keyof O]: O[k] extends Maybe<infer T> ? T : never }>;
}
type SequenceAOResult<A, O> = SequenceAOResults<O>[Fallback<GetMatch<A>>];
function sequenceAO<A extends Applicative, O>(A: A, obj: O): SequenceAOResult<A, O> {
	return Object.keys(obj).reduce(
		(result, key) =>
			(obj as any)[key].ap(
				result.map((dest: any) => (source: any) => Object.assign(dest, { [key]: source }))
			),
		A.of({}) as any
	);
}

function sincronizarSelectInput(
	select: HTMLSelectElement,
	input: HTMLInputElement,
	casoMude: () => void
) {
	if (select.value) {
		input.value = select.value;
		casoMude();
	}
}

function whenDocumentInteractive(): Promise<void> {
	return new Promise(res => {
		if (document.readyState === 'loading') {
			document.addEventListener('readystatechange', onReadyStateChange);
		} else {
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

// Constantes

type Resultado = Validation<void>;
const Paginas = new Map<string, (preferencias: PreferenciasObject, pagina: string) => Resultado>([
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
	['incluirMinutaBV', incluirMinutaBV],
	['incluirMinutaSI', incluirMinutaSI],
	['pesquisarPorAssessor', consultarPorAssessor],
	['pesquisarPorJuizo', consultarPorJuizo],
	['pesquisarPorProcesso', consultarPorProcesso],
	['pesquisarPorProtocolo', consultarPorProtocolo],
]);

main();
