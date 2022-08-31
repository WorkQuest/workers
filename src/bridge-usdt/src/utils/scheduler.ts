import { Pool } from 'pg';

export async function addJob(taskName: string, payload?: any, userOptions: any = {}) {
  try {
    const pool = new Pool({ connectionString: process.env.DB_LINK });
    const args = ['$1::text'];
    const options = { ...{ max_attempts: 1 }, ...userOptions };
    const values = [taskName];
    if (payload) {
      args.push('payload := $2');
      values.push(JSON.stringify(payload));
    }

    if (options) {
      let argumentPos = values.length;
      ['queue_name', 'max_attempts', 'run_at', 'interval'].forEach((col) => {
        if (options[col]) {
          argumentPos++;
          if (col === 'interval') {
            args.push(`run_at := NOW() + ($${argumentPos} * INTERVAL '1 minute')`);
          } else {
            args.push(`${col} := $${argumentPos}`);
          }

          values.push(options[col]);
        }
      });
    }
    const query = `SELECT worker_token_swap_txs.add_job(${args.join(', ')});`;
    await pool.query(query, values);
    await pool.end();
  } catch (e) {
    console.log(e);
  }
}
