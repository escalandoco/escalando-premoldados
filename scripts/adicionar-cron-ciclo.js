#!/usr/bin/env node
/**
 * Adiciona verificar-ciclo-campanha ao crontab do VPS
 * Roda uma única vez para atualizar o cron existente.
 * Uso: node scripts/adicionar-cron-ciclo.js
 */
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const DIR = '/opt/escalando-premoldados';
const CRON_CMD = `${DIR}/scripts/cron-runner.sh`;
const NEW_LINE = `5 11 * * * ${CRON_CMD} verificar-ciclo-campanha concrenor >> /var/log/escalando-ciclo-campanha.log 2>&1`;

(async () => {
  try {
    // Lê crontab atual
    const { stdout: atual } = await execAsync('crontab -l 2>/dev/null || true');

    if (atual.includes('verificar-ciclo-campanha')) {
      console.log('✅ Cron verificar-ciclo-campanha já configurado.');
      return;
    }

    // Adiciona a nova linha após a linha do monitorar-ads
    const linhas = atual.trim().split('\n');
    const idxMonitor = linhas.findIndex(l => l.includes('monitorar-ads'));
    if (idxMonitor >= 0) {
      linhas.splice(idxMonitor + 1, 0, '# Ciclo de campanha (D+7/D+15) — todo dia 08h05 BRT', NEW_LINE);
    } else {
      linhas.push('# Ciclo de campanha (D+7/D+15) — todo dia 08h05 BRT', NEW_LINE);
    }

    const novoCrontab = linhas.join('\n') + '\n';
    await execAsync(`echo '${novoCrontab.replace(/'/g, "'\\''")}' | crontab -`);
    console.log('✅ Cron verificar-ciclo-campanha adicionado com sucesso!');

    // Confirma
    const { stdout: confirmado } = await execAsync('crontab -l');
    const ok = confirmado.includes('verificar-ciclo-campanha');
    console.log(ok ? '✅ Confirmado no crontab.' : '⚠️ Não encontrado no crontab — verifique manualmente.');
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  }
})();
