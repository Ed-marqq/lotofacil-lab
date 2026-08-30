# Modelo Matemático — Lotofácil Lab v1.0

## 1. Espaço amostral

A Lotofácil é modelada como a escolha de 15 dezenas distintas entre 25:

\[
|\Omega| = \binom{25}{15} = 3.268.760
\]

Para sorteio uniforme, cada combinação de 15 dezenas tem probabilidade:

\[
P(S)=1/\binom{25}{15}.
\]

Nenhuma estatística histórica pode alterar essa probabilidade teórica sem evidência de que o mecanismo gerador tenha algum desvio.

## 2. Distribuição de acertos

Para uma aposta de 15 números e sorteio de 15 números:

\[
X\sim Hypergeometric(N=25,K=15,n=15)
\]

e:

\[
P(X=k)=
\frac{\binom{15}{k}\binom{10}{15-k}}
{\binom{25}{15}}.
\]

Essa distribuição é usada como baseline matemática.

## 3. Frequência marginal

Para qualquer dezena \(i\):

\[
p_i=15/25=0,6.
\]

Após \(D\) concursos:

\[
E[f_i]=0,6D
\]

e a aproximação binomial para o desvio-padrão é:

\[
\sigma_i=\sqrt{D(0,6)(0,4)}.
\]

O z-score implementado é:

\[
z_i=\frac{f_i-0,6D}{\sigma_i}.
\]

O z-score é diagnóstico; não é prova de previsibilidade.

## 4. Qui-quadrado

A estatística global usada é:

\[
\chi^2=\sum_{i=1}^{25}\frac{(O_i-E_i)^2}{E_i}
\]

com 24 graus de liberdade.

A interface usa a aproximação de Wilson-Hilferty apenas para exibir um p-valor aproximado. Para análise científica mais rigorosa, a próxima versão deve trocar essa aproximação por uma rotina de CDF de \(\chi^2\) de precisão numérica controlada.

## 5. Janelas móveis

São calculadas frequências em janelas de:

- 10
- 20
- 50
- 100
- 500

concursos, quando o histórico é suficientemente grande.

A janela recente entra no score como feature experimental.

## 6. Bayes / Beta-Binomial

Cada dezena recebe:

\[
p_i\sim Beta(1,1)
\]

e, com \(x_i\) aparições em \(D\) concursos:

\[
p_i|D\sim Beta(1+x_i,1+D-x_i).
\]

A média posterior:

\[
E[p_i|D]=\frac{1+x_i}{2+D}.
\]

O objetivo do prior é reduzir exageros de amostras finitas, não criar uma vantagem artificial.

## 7. Coocorrência e lift

Para cada par \(i,j\):

\[
f_{ij}=\#\{t:i,j\in S_t\}.
\]

A expectativa aproximada por concurso é:

\[
E[f_{ij}]
=
D\frac{15}{25}\frac{14}{24}.
\]

O lift usado pelo ranking é:

\[
Lift(i,j)
=
\frac{P(i,j)}{P(i)P(j)}.
\]

O score usa a média do log do lift, com truncamento para impedir que uma estimativa extrema domine todo o modelo.

## 8. Trincas

O código também contabiliza trincas nos últimos 50 concursos para preparar a camada de interação de ordem 3. Na v1.0 elas ainda não entram diretamente no score, porque o tamanho amostral de 50 é pequeno para estimar milhares de eventos raros com segurança.

Essa decisão é intencional: uma feature de alta dimensionalidade sem regularização pode produzir overfitting.

## 9. Estrutura da combinação

Para cada combinação candidata são calculados:

- soma das dezenas;
- número de ímpares;
- número de pares;
- número de pares consecutivos;
- maior gap entre dezenas;
- quantidade de números repetidos do último concurso.

Essas estatísticas são comparadas com suas distribuições empíricas históricas usando suavização de Laplace.

## 10. Repetição entre concursos

Para dois concursos consecutivos:

\[
R_t=|S_t\cap S_{t-1}|.
\]

Sob sorteios independentes com 15 de 25:

\[
R_t\sim Hypergeometric(25,15,15).
\]

O valor esperado é:

\[
E[R_t]=15\cdot\frac{15}{25}=9.
\]

O software usa a distribuição histórica como feature e, para diagnóstico, Monte Carlo como referência.

## 11. Dependência temporal

Para cada dezena, cria-se:

\[
X_t=
\begin{cases}
1,& i\in S_t\\
0,& i\notin S_t.
\end{cases}
\]

São calculadas autocorrelações nos lags 1 e 2 e um Runs Z.

Essas métricas são tratadas como sinais experimentais de dependência. Valores próximos de zero são compatíveis com ausência de autocorrelação.

## 12. Monte Carlo

São geradas combinações aleatórias uniformes para formar distribuições de referência.

O objetivo é distinguir:

\[
\text{desvio observado}
\]

de

\[
\text{variação esperada pelo acaso}.
\]

O Monte Carlo não "prevê" as dezenas.

## 13. Score de combinação

Para uma combinação \(A\), a v1.0 usa:

\[
Score(A)=
w_f F(A)
+w_r R(A)
+w_b B(A)
+w_p P(A)
+w_s S(A)
+w_{rep}Rep(A)
+w_t T(A)
+w_{reg}Reg(A).
\]

Onde:

- \(F(A)\): soma padronizada dos z-scores das dezenas;
- \(R(A)\): sinal de frequência recente;
- \(B(A)\): sinal Bayesiano;
- \(P(A)\): média de log-lift dos pares;
- \(S(A)\): probabilidade empírica de características estruturais;
- \(Rep(A)\): aderência à distribuição de repetição;
- \(T(A)\): autocorrelação das dezenas;
- \(Reg(A)\): regularização de dispersão.

Os pesos ficam expostos na interface para experimentação e, no futuro, deverão ser escolhidos por backtesting e validação fora da amostra, em vez de por opinião.

## 14. Geração de candidatos

Não é viável enumerar todas as 3.268.760 combinações a cada clique se o objetivo for manter a interface rápida em navegador.

A v1.0 usa amostragem uniforme de um número configurável de combinações candidatas e calcula o score completo de cada uma.

A distribuição das amostras é uniforme sobre o espaço de combinações.

## 15. Diversificação

Após o ranking, não são escolhidas simplesmente as 10 primeiras.

Para cada novo jogo:

\[
Score'(A)=Score(A)-\lambda\max_{B\in G}|A\cap B|/15
\]

onde \(G\) é o conjunto de jogos já selecionados.

Isso reduz a redundância entre as 10 apostas.

## 16. Backtesting walk-forward

Para cada ponto temporal \(t\):

1. usa apenas concursos anteriores a \(t\);
2. treina/calcula as estatísticas;
3. gera 10 jogos;
4. compara com o concurso \(t\);
5. compara simultaneamente com 10 jogos aleatórios.

São registradas:

- melhor quantidade de acertos;
- ocorrências de 13+;
- ocorrências de 14+;
- ocorrências de 15;
- média do melhor jogo.

A comparação com uma baseline aleatória é indispensável.

## 17. Prevenção de leakage

Nunca é usado o concurso \(t\) para construir o modelo que será testado contra o próprio concurso \(t\).

Não há utilização de informação futura.

## 18. Próximas versões recomendadas

Antes de aumentar a complexidade do modelo:

1. implementar p-values exatos ou de alta precisão;
2. corrigir múltiplos testes para pares/trincas;
3. adicionar testes de permutação;
4. adicionar otimização MILP/CP-SAT opcional;
5. calibrar pesos por validação temporal;
6. criar relatórios de estabilidade;
7. só então testar modelos de machine learning.

