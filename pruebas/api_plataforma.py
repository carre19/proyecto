"""Pruebas de punta a punta de la API de la plataforma (login de los 5 roles, aislamiento entre boliches,
permisos de cada rol, boliches, equipo, eventos y la parte pública).

Hay que correrlas contra una base RECIÉN cargada con los datos de prueba, porque crean y borran datos:
    ./database/cargar_base.sh --reset
    npm run dev                      # en otra terminal
    python3 pruebas/api_plataforma.py          # o: API=http://localhost:3001/api python3 pruebas/api_plataforma.py

Cada línea dice OK o FALLA; al final resume. Sale con código distinto de 0 si algo falla.
"""
import json, urllib.request, urllib.error
import os
B=os.environ.get("API", "http://localhost:3000/api")
def call(m, path, body=None, tk=None):
    req=urllib.request.Request(B+path, method=m, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tk} if tk else {})})
    try:
        r=urllib.request.urlopen(req); return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try: d=json.loads(e.read())
        except Exception: d={}
        return e.code, d
fallas=[]
def chk(n,resp,esp,cond=None):
    ok=resp[0]==esp and (cond is None or cond(resp[1]))
    print(("OK   " if ok else "FALLA"),f"[{resp[0]}]",n,"" if ok else "-> "+json.dumps(resp[1],ensure_ascii=False)[:220])
    if not ok: fallas.append(n)
    return resp[1]
def login(e,p="demo12345"):
    s,d=call("POST","/auth/login",{"email":e,"password":p}); assert s==200,(e,d); return d["token"],d["usuario"]
TS,US=login("superadmin@demo.com"); TA1,UA1=login("admin1@demo.com"); TA2,UA2=login("admin2@demo.com")
TM,UM=login("manager1@demo.com"); TR1,UR1=login("rrpp1@demo.com"); TR2,UR2=login("rrpp2@demo.com"); TC,UC=login("cliente@demo.com")
print("== Login y panel de cada rol ==")
for u,rol,n in [(US,"superadmin",3),(UA1,"admin",2),(UA2,"admin",1),(UM,"rrpp_manager",1),(UR1,"rrpp",1),(UC,"cliente",0)]:
    ok=u["rol"]==rol and len(u["boliches"])==n; print(("OK   " if ok else "FALLA"),f"{u['email']:22s} rol={u['rol']:13s} boliches={len(u['boliches'])} (esperado {n})"); 
    if not ok: fallas.append("panel "+rol)
chk("login con clave mala",call("POST","/auth/login",{"email":"admin1@demo.com","password":"x"}),401)
chk("login con email inexistente (mismo mensaje)",call("POST","/auth/login",{"email":"no@x.com","password":"demo12345"}),401)
chk("sin token",call("GET","/boliches"),401)
print("== Registro: solo clientes ==")
r=chk("registro de un cliente",call("POST","/auth/register",{"nombre":"Nuevo","apellido":"Cliente","email":"Nuevo@Mail.com","password":"clave12345","dni":"40123456"}),201,lambda d:d["rol"]=="cliente" and d["email"]=="nuevo@mail.com")
chk("no se puede registrar como admin (el rol se ignora)",call("POST","/auth/register",{"nombre":"A","apellido":"B","email":"hack@mail.com","password":"clave12345","rol":"superadmin"}),201,lambda d:d["rol"]=="cliente")
chk("email repetido (sin importar mayúsculas)",call("POST","/auth/register",{"nombre":"A","apellido":"B","email":"ADMIN1@demo.com","password":"clave12345"}),409)
chk("clave corta",call("POST","/auth/register",{"nombre":"A","apellido":"B","email":"c@mail.com","password":"123"}),400)
chk("DNI inválido",call("POST","/auth/register",{"nombre":"A","apellido":"B","email":"d@mail.com","password":"clave12345","dni":"12.345"}),400)
print("== AISLAMIENTO: cada local ve solo lo suyo ==")
ids={b["nombre"]:b["id_boliche"] for b in UA1["boliches"]+UA2["boliches"]}; U,D,T=ids["Boliche Uno"],ids["Bar Dos"],ids["Club Tres"]
chk("admin1 ve solo sus 2 boliches",call("GET","/boliches",None,TA1),200,lambda d:sorted(b["nombre"] for b in d)==["Bar Dos","Boliche Uno"])
chk("admin2 ve solo Club Tres",call("GET","/boliches",None,TA2),200,lambda d:[b["nombre"] for b in d]==["Club Tres"])
chk("superadmin ve los 3",call("GET","/boliches",None,TS),200,lambda d:len(d)==3)
chk("manager ve solo su boliche",call("GET","/boliches",None,TM),200,lambda d:[b["nombre"] for b in d]==["Boliche Uno"])
chk("cliente NO entra al panel de boliches",call("GET","/boliches",None,TC),403)
chk("admin2 pide el boliche de admin1 -> 404",call("GET",f"/boliches/{U}",None,TA2),404)
chk("admin2 pide los eventos de otro boliche -> 404",call("GET",f"/boliches/{U}/eventos",None,TA2),404)
chk("admin2 NO puede crear eventos en otro boliche",call("POST",f"/boliches/{U}/eventos",{"nombre":"Colado","fecha_hora":"2027-01-01T23:00:00-03:00"},TA2),404)
chk("admin2 NO ve el equipo de otro boliche",call("GET",f"/boliches/{U}/equipo",None,TA2),404)
chk("manager NO entra a otro boliche de su misma plataforma",call("GET",f"/boliches/{D}/eventos",None,TM),404)
chk("RRPP ve eventos de su boliche",call("GET",f"/boliches/{U}/eventos",None,TR1),200,lambda d:len(d)>=2)
chk("RRPP NO ve el equipo",call("GET",f"/boliches/{U}/equipo",None,TR1),403)
chk("RRPP NO crea eventos",call("POST",f"/boliches/{U}/eventos",{"nombre":"X","fecha_hora":"2027-01-01T23:00:00-03:00"},TR1),403)
print("== Superadmin: boliches y admins ==")
b=chk("crear boliche con admin nuevo",call("POST","/boliches",{"nombre":"Pub Cuatro","subdominio":"pub-cuatro","capacidad":300,"monto_mensual":80000,"admin":{"nombre":"Dani","apellido":"Dueño","email":"admin3@demo.com","password":"clave12345"}},TS),201,lambda d:len(d["admins"])==1 and d["activo"])
chk("subdominio repetido",call("POST","/boliches",{"nombre":"Otro","subdominio":"pub-cuatro","id_admins":[UA1["id"]]},TS),409)
chk("subdominio inválido",call("POST","/boliches",{"nombre":"Otro","subdominio":"Mi Pub","id_admins":[UA1["id"]]},TS),400)
chk("boliche sin admin",call("POST","/boliches",{"nombre":"Otro","subdominio":"sin-admin"},TS),400)
chk("admin NO crea boliches",call("POST","/boliches",{"nombre":"X","subdominio":"xxx","id_admins":[UA1["id"]]},TA1),403)
chk("asignar un cliente como admin -> la base lo rechaza",call("POST",f"/boliches/{b['id_boliche']}/admins",{"id_usuario":UC["id"]},TS),400)
chk("sumar a admin1 como admin de Pub Cuatro",call("POST",f"/boliches/{b['id_boliche']}/admins",{"id_usuario":UA1["id"]},TS),201,lambda d:len(d["admins"])==2)
chk("quitar un admin (queda 1)",call("DELETE",f"/boliches/{b['id_boliche']}/admins/{UA1['id']}",None,TS),200,lambda d:len(d["admins"])==1)
chk("NO se puede quitar al último admin",call("DELETE",f"/boliches/{b['id_boliche']}/admins/{b['admins'][0]['id_usuario']}",None,TS),400)
chk("admin edita datos de su local",call("PUT",f"/boliches/{U}",{"descripcion":"Nueva descripción","capacidad":900},TA1),200,lambda d:d["capacidad"]==900)
chk("admin NO cambia subdominio ni cobro",call("PUT",f"/boliches/{U}",{"subdominio":"robado","monto_mensual":1},TA1),403)
chk("admin NO se desactiva el boliche",call("PUT",f"/boliches/{U}",{"activo":False},TA1),403)
chk("manager NO edita el boliche",call("PUT",f"/boliches/{U}",{"capacidad":1},TM),403)
chk("superadmin desactiva Pub Cuatro",call("PUT",f"/boliches/{b['id_boliche']}",{"activo":False},TS),200,lambda d:not d["activo"])
TA3,_=login("admin3@demo.com","clave12345"); chk("admin de boliche desactivado: 403",call("GET",f"/boliches/{b['id_boliche']}",None,TA3),403)
print("== Usuarios (solo superadmin) ==")
chk("superadmin lista usuarios",call("GET","/usuarios",None,TS),200,lambda d:len(d)>=8)
chk("filtrar por rol",call("GET","/usuarios?rol=rrpp",None,TS),200,lambda d:len(d)==2 and all(x["rol"]=="rrpp" for x in d))
chk("admin NO lista usuarios",call("GET","/usuarios",None,TA1),403)
chk("no puede desactivarse a sí mismo",call("PUT",f"/usuarios/{US['id']}",{"activo":False},TS),400)
chk("desactivar una cuenta",call("PUT",f"/usuarios/{r['id']}",{"activo":False},TS),200)
chk("cuenta desactivada no entra",call("POST","/auth/login",{"email":"nuevo@mail.com","password":"clave12345"}),403)
print("== Equipo: admin, manager y RRPP ==")
m=chk("admin da de alta un RRPP con comisión",call("POST",f"/boliches/{U}/equipo",{"rol":"rrpp","nombre":"Nico","apellido":"Nuevo","email":"rrpp3@demo.com","password":"clave12345","dni":"41000001","comision_pct":12.5},TA1),201,lambda d:d["comision_pct"]=="12.50")
chk("admin da de alta un manager",call("POST",f"/boliches/{D}/equipo",{"rol":"rrpp_manager","nombre":"Mara","apellido":"Mgr","email":"manager2@demo.com","password":"clave12345"},TA1),201)
chk("comisión > 100",call("POST",f"/boliches/{U}/equipo",{"rol":"rrpp","nombre":"X","apellido":"Y","email":"x1@demo.com","password":"clave12345","comision_pct":150},TA1),400)
chk("rol inválido",call("POST",f"/boliches/{U}/equipo",{"rol":"admin","nombre":"X","apellido":"Y","email":"x2@demo.com","password":"clave12345"},TA1),400)
chk("manager ve sus RRPP + los sin manager",call("GET",f"/boliches/{U}/equipo",None,TM),200,lambda d:{x["email"] for x in d}=={"rrpp1@demo.com","rrpp2@demo.com","rrpp3@demo.com"})
chk("manager da de alta un RRPP (queda a su cargo)",call("POST",f"/boliches/{U}/equipo",{"rol":"rrpp","nombre":"Pía","apellido":"Pérez","email":"rrpp4@demo.com","password":"clave12345"},TM),201,lambda d:d["id_manager"]==UM["id"] and d["comision_pct"]=="0.00")
chk("manager NO da de alta otro manager",call("POST",f"/boliches/{U}/equipo",{"rol":"rrpp_manager","nombre":"X","apellido":"Y","email":"x3@demo.com","password":"clave12345"},TM),403)
chk("manager asigna un RRPP libre a sí mismo",call("PUT",f"/boliches/{U}/equipo/{UR2['id']}",{"id_manager":UM["id"]},TM),200,lambda d:d["id_manager"]==UM["id"])
chk("manager desasigna",call("PUT",f"/boliches/{U}/equipo/{UR2['id']}",{"id_manager":None},TM),200,lambda d:d["id_manager"] is None)
chk("manager NO cambia la comisión (la fija el admin)",call("PUT",f"/boliches/{U}/equipo/{UR2['id']}",{"comision_pct":50},TM),403)
chk("manager NO asigna a otro manager",call("PUT",f"/boliches/{U}/equipo/{UR2['id']}",{"id_manager":9999},TM),403)
chk("admin fija la comisión",call("PUT",f"/boliches/{U}/equipo/{UR2['id']}",{"comision_pct":15},TA1),200,lambda d:d["comision_pct"]=="15.00")
chk("RRPP del equipo con manager de otro boliche (base lo rechaza)",call("PUT",f"/boliches/{U}/equipo/{UR2['id']}",{"id_manager":UA1["id"]},TA1),400)
chk("admin2 NO toca el equipo de Boliche Uno",call("PUT",f"/boliches/{U}/equipo/{UR2['id']}",{"comision_pct":99},TA2),404)
chk("baja de un RRPP (queda desactivado)",call("DELETE",f"/boliches/{U}/equipo/{m['id_usuario']}",None,TA1),200)
chk("el RRPP dado de baja ya no entra",call("POST","/auth/login",{"email":"rrpp3@demo.com","password":"clave12345"}),403)
chk("manager NO da de baja",call("DELETE",f"/boliches/{U}/equipo/{UR1['id']}",None,TM),403)
print("== Eventos ==")
e=chk("admin crea evento completo",call("POST",f"/boliches/{U}/eventos",{"nombre":"Noche Techno","fecha_hora":"2027-02-05T23:30:00-03:00","artistas":["DJ A","DJ B"],"edad_minima":21,"dress_code":"Negro","tiene_vip":True,"mesas_vip":10,"descripcion":"x"},TA1),201,lambda d:d["artistas"]==["DJ A","DJ B"] and d["edad_minima"]==21 and d["mesas_vip"]==10)
chk("artistas como texto con comas",call("POST",f"/boliches/{U}/eventos",{"nombre":"Otra","fecha_hora":"2027-02-06T23:30:00-03:00","artistas":"DJ X, DJ Y"},TA1),201,lambda d:d["artistas"]==["DJ X","DJ Y"])
em=chk("manager crea evento",call("POST",f"/boliches/{U}/eventos",{"nombre":"Del manager","fecha_hora":"2027-02-07T23:00:00-03:00"},TM),201)
chk("mesas VIP sin sector VIP",call("POST",f"/boliches/{U}/eventos",{"nombre":"X","fecha_hora":"2027-02-07T23:00:00-03:00","mesas_vip":4},TA1),400)
chk("fecha inválida",call("POST",f"/boliches/{U}/eventos",{"nombre":"X","fecha_hora":"mañana"},TA1),400)
chk("manager edita SU evento",call("PUT",f"/boliches/{U}/eventos/{em['id_evento']}",{"nombre":"Del manager (editado)"},TM),200)
chk("manager NO edita el evento del admin",call("PUT",f"/boliches/{U}/eventos/{e['id_evento']}",{"nombre":"robado"},TM),403)
chk("admin edita cualquiera",call("PUT",f"/boliches/{U}/eventos/{em['id_evento']}",{"estado":"cancelado"},TA1),200,lambda d:d["estado"]=="cancelado")
chk("quitar el VIP limpia las mesas",call("PUT",f"/boliches/{U}/eventos/{e['id_evento']}",{"tiene_vip":False},TA1),200,lambda d:d["mesas_vip"] is None)
chk("evento de OTRO boliche con el id de este -> 404",call("GET",f"/boliches/{D}/eventos/{e['id_evento']}",None,TA1),404)
chk("admin2 NO borra eventos de otro boliche",call("DELETE",f"/boliches/{U}/eventos/{e['id_evento']}",None,TA2),404)
chk("manager NO borra",call("DELETE",f"/boliches/{U}/eventos/{em['id_evento']}",None,TM),403)
chk("admin borra",call("DELETE",f"/boliches/{U}/eventos/{em['id_evento']}",None,TA1),200)
print("== Público (sin cuenta) ==")
chk("lista de boliches activos (no incluye el desactivado)",call("GET","/publico/boliches"),200,lambda d:len(d)==3 and all("monto_mensual" not in x for x in d))
chk("página del boliche con próximos eventos",call("GET","/publico/boliches/boliche-uno"),200,lambda d:len(d["eventos"])>=2 and d["nombre"]=="Boliche Uno" and "monto_mensual" not in d and "tipo_cobro" not in d)
chk("boliche desactivado no se ve",call("GET","/publico/boliches/pub-cuatro"),404)
chk("los eventos cancelados no se muestran",call("GET","/publico/boliches/boliche-uno"),200,lambda d:all(x["nombre"]!="Del manager (editado)" for x in d["eventos"]))
print("\nFALLAS:",fallas or "ninguna")
import sys
sys.exit(1 if fallas else 0)
