import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../apps/web/.env.local') });

async function apply() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceKey) {
    console.error('Missing credentials');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Seeding new permissions into Supabase DB...');

  // 1. Insert permissions
  const permissions = [
    {
      key: 'task.assign',
      scope: 'project',
      group_name: 'task',
      label: 'Assign Tasks to Others',
      description: 'Assign or reassign tasks to team members',
      is_assignable: true,
    },
    {
      key: 'task.self_assign',
      scope: 'project',
      group_name: 'task',
      label: 'Self-Assign Tasks',
      description: 'Assign or unassign oneself to tasks',
      is_assignable: true,
    },
    {
      key: 'task.assignable',
      scope: 'project',
      group_name: 'task',
      label: 'Assignable to Tasks',
      description: 'Permit this role to be selected as a task assignee',
      is_assignable: true,
    },
  ];

  for (const perm of permissions) {
    const { data, error } = await supabase
      .from('permissions')
      .upsert(perm, { onConflict: 'key' })
      .select('id, key')
      .single();

    if (error) {
      console.error(`Failed to upsert permission ${perm.key}:`, error.message);
    } else {
      console.log(`[OK] Permission upserted: ${perm.key} (${data.id})`);
    }
  }

  // 2. Fetch roles and permissions
  const { data: roles } = await supabase.from('roles').select('id, name');
  const { data: allPerms } = await supabase.from('permissions').select('id, key');

  if (!roles || !allPerms) {
    console.error('Failed to fetch roles or permissions');
    return;
  }

  const permMap = new Map(allPerms.map((p) => [p.key, p.id]));

  for (const role of roles) {
    let targetKeys: string[] = [];
    if (role.name === 'Admin') {
      targetKeys = ['task.assign', 'task.self_assign', 'task.assignable'];
    } else if (role.name === 'Manager') {
      targetKeys = ['task.assign', 'task.self_assign', 'task.assignable'];
    } else if (role.name === 'Member') {
      targetKeys = ['task.self_assign', 'task.assignable'];
    }

    for (const key of targetKeys) {
      const pId = permMap.get(key);
      if (!pId) continue;

      const { error } = await supabase
        .from('role_permissions')
        .upsert({ role_id: role.id, permission_id: pId }, { onConflict: 'role_id, permission_id' });

      if (error) {
        console.warn(`Could not link ${key} to ${role.name}:`, error.message);
      } else {
        console.log(`[OK] Linked ${key} to role ${role.name}`);
      }
    }
  }

  console.log('--- Migration completed successfully ---');
}

apply().catch(console.error);

