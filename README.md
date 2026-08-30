# Lotofácil Lab

Aplicação estática para análise experimental da Lotofácil.

## Características

- Entrada por texto no formato:
  `Concurso: 3769 | Data: 23/08/2026 | Números: 01 02 ... 25`
- Analisa as 15 dezenas de cada concurso.
- Usa concurso/data apenas para ordenar e preservar a série temporal.
- Não usa backend, banco ou `localStorage`.
- Gera exatamente 10 combinações por rodada.
- Inclui diagnóstico estatístico, análise temporal, pares/coocorrência, modelo Beta-Binomial, Monte Carlo e otimização por diversificação.
- Inclui backtesting walk-forward para comparar a estratégia com uma baseline aleatória.

## Estrutura

```text
/
├── index.html
├── app.js
├── styles.css
├── .nojekyll
├── docs/
│   └── MODELO-MATEMATICO.md
└── .github/workflows/deploy.yml
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Faça upload destes arquivos e confirme na branch `main`.
3. Em `Settings > Pages`, selecione **GitHub Actions** como fonte de publicação.
4. O workflow em `.github/workflows/deploy.yml` fará o deploy automático.

O projeto não precisa de Node, Python ou servidor para rodar.

## Aviso estatístico

O sistema não demonstra que alguma combinação tenha probabilidade teórica maior do que outra em um sorteio uniforme. O objetivo é experimentar hipóteses estatísticas e otimização de conjuntos de apostas.

O backtesting é obrigatório para qualquer conclusão sobre utilidade preditiva. Uma melhoria dentro da amostra não é evidência suficiente.

## Modelo matemático

Ver `docs/MODELO-MATEMATICO.md`.
