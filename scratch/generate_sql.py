import json

json_path = "/Users/renatogioia/.gemini/antigravity-ide/brain/83fc0e9e-216a-454b-8915-12e15beefe76/scratch/freelancers.json"

with open(json_path, "r", encoding="utf-8") as f:
    freelancers = json.load(f)

print(f"Loaded {len(freelancers)} freelancers from JSON.")

# Collect unique industries
all_industries = set()
for f in freelancers:
    segments = f.get("segments", [])
    for s in segments:
        if s.strip():
            name = s.strip()
            if "remoto" in name.lower() or "híbrido" in name.lower():
                name = name.replace("100% remoto", "").replace("Híbrido", "").strip()
            if name:
                all_industries.add(name)

all_industries = sorted(list(all_industries))

def map_location(loc):
    city = "NULL"
    state = "NULL"
    l = (loc or "").strip()
    if "RJ" in l:
        state = "'RJ'"
        if "capital" in l.lower():
            city = "'Rio de Janeiro'"
    elif "SP" in l:
        state = "'SP'"
        if "capital" in l.lower():
            city = "'São Paulo'"
        elif "interior" in l.lower():
            city = "'Interior'"
    elif l == "RS":
        state = "'RS'"
    elif l == "SC":
        state = "'SC'"
    elif l == "DF":
        state = "'DF'"
        city = "'Brasília'"
    return city, state

def map_seniority(planner_score, ppt_score):
    scores = []
    if planner_score is not None:
        scores.append(planner_score)
    if ppt_score is not None:
        scores.append(ppt_score)
    
    avg = sum(scores) / len(scores) if scores else 7.0
    if avg >= 9.0:
        return "senior"
    elif avg >= 7.0:
        return "pleno"
    else:
        return "junior"

def map_status_and_avail(sit):
    situation = (sit or "").lower()
    status = "elegivel"
    availability = "sob_consulta"
    
    if "não consegue" in situation or "não consigo" in situation or "não trabalha como freela" in situation or "não atua como freela" in situation or "vinculado no momento e não consigo" in situation:
        status = "inativo"
        availability = "indisponivel"
    elif "restrito" in situation or "finais de semana" in situation or "horários restritos" in situation or "vinculado" in situation:
        status = "em_observacao"
        availability = "conflito_parcial"
    elif "100% freela" in situation or "disponibilidade" in situation or "autônom" in situation or "freela" in situation:
        status = "elegivel"
        availability = "disponivel"
        
    return status, availability

# Generate 5 parts of ~15 freelancers each
chunk_size = 15
for chunk_idx in range(0, len(freelancers), chunk_size):
    part_num = (chunk_idx // chunk_size) + 1
    group_freelas = freelancers[chunk_idx : chunk_idx + chunk_size]
    output_path = f"/Users/renatogioia/.gemini/antigravity-ide/brain/83fc0e9e-216a-454b-8915-12e15beefe76/scratch/import_talents_part{part_num}.sql"
    
    sql_lines = []
    sql_lines.append("BEGIN;")
    
    if part_num == 1:
        sql_lines.append("-- Insert unique industries")
        for ind in all_industries:
            escaped_ind = ind.replace("'", "''")
            sql_lines.append(f"INSERT INTO public.industries (name) VALUES ('{escaped_ind}') ON CONFLICT (name) DO NOTHING;")
        sql_lines.append("")
        
    for idx, f in enumerate(group_freelas):
        global_idx = chunk_idx + idx + 1
        name = f.get("name", "").strip().replace("'", "''")
        email = f.get("email", "").strip().replace("'", "''")
        whatsapp = f.get("whatsapp", "").strip().replace("'", "''")
        linkedin = f.get("linkedin", "").strip().replace("'", "''")
        location = f.get("location", "").strip().replace("'", "''")
        
        planner_score = f.get("planner_score")
        ppt_score = f.get("powerpoint_score")
        
        worked_with_v3a = f.get("worked_with_v3a", "").strip().replace("'", "''")
        v3a_projects = f.get("v3a_projects", "").strip().replace("'", "''")
        situation = f.get("situation", "").strip().replace("'", "''")
        contract_type = f.get("contract_type", "").strip().replace("'", "''")
        brands = f.get("brands", "").strip().replace("'", "''")
        
        city, state = map_location(f.get("location", ""))
        seniority = map_seniority(planner_score, ppt_score)
        status, availability = map_status_and_avail(f.get("situation", ""))
        
        p_score_str = str(planner_score) if planner_score is not None else "NULL"
        ppt_score_str = str(ppt_score) if ppt_score is not None else "NULL"
        
        sql_lines.append(f"-- Freelancer {global_idx}: {name}")
        sql_lines.append("DO $$")
        sql_lines.append("DECLARE")
        sql_lines.append("  f_id uuid;")
        sql_lines.append("BEGIN")
        
        # Insert Freelancer
        sql_lines.append(f"""  INSERT INTO public.freelancers (
    full_name, email, whatsapp, linkedin_url, location_text, city, state,
    main_function_id, seniority, status, availability,
    planner_score, powerpoint_score, has_worked_with_v3a, v3a_projects, current_situation, contract_type, brands_worked,
    imported_from, imported_at
  ) VALUES (
    '{name}', '{email}', '{whatsapp}', '{linkedin}', '{location}', {city}, {state},
    (SELECT id FROM public.freela_functions WHERE name = 'Planejamento' LIMIT 1), '{seniority}', '{status}', '{availability}',
    {p_score_str}, {ppt_score_str}, '{worked_with_v3a}', '{v3a_projects}', '{situation}', '{contract_type}', '{brands}',
    'xlsx_import', now()
  ) RETURNING id INTO f_id;""")
      
        # Mappings
        segments = f.get("segments", [])
        for s in segments:
            s_cleaned = s.strip()
            if "remoto" in s_cleaned.lower() or "híbrido" in s_cleaned.lower():
                s_cleaned = s_cleaned.replace("100% remoto", "").replace("Híbrido", "").strip()
            if s_cleaned:
                s_escaped = s_cleaned.replace("'", "''")
                sql_lines.append(f"  INSERT INTO public.freelancer_industries (freelancer_id, industry_id) VALUES (f_id, (SELECT id FROM public.industries WHERE name = '{s_escaped}' LIMIT 1)) ON CONFLICT DO NOTHING;")
                
        sql_lines.append("END $$;")
        sql_lines.append("")
        
    sql_lines.append("COMMIT;")
    
    with open(output_path, "w", encoding="utf-8") as out:
        out.write("\n".join(sql_lines))
        
    print(f"Generated part {part_num} ({len(group_freelas)} freelancers) at {output_path}")
