interface Window {
	wrappedJSObject: UnsafeWindow;
}

interface UnsafeWindow extends Window {
	excluirPessoa(): void;
	excluirReu(): void;
}
