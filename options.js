"use strict";
// Salvar as alterações
const inputs = Array.from(document.querySelectorAll('input, select'));
inputs.forEach(input => {
    input.addEventListener('change', () => {
        const promise = input.value.trim() === ''
            ? browser.storage.local.remove(input.id)
            : browser.storage.local.set({ [input.id]: input.value });
        promise.catch(err => console.error(err));
    });
});
const inputsById = new Map(inputs.map(input => [input.id, input]));
// Observar mudanças feitas em outras páginas
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local')
        return;
    const changed = Object.keys(changes);
    changed.forEach(key => {
        const input = inputsById.get(key);
        if (input) {
            input.value = changes[key].newValue || '';
        }
    });
});
// Carregar os valores salvos
browser.storage.local
    .get(Array.from(inputsById.keys()))
    .then(prefs => {
    Object.keys(prefs).forEach(key => {
        const input = inputsById.get(key);
        if (input) {
            input.value = prefs[key];
        }
    });
})
    .catch(err => console.error(err));
