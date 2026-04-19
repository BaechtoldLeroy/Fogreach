// js/ai/steering.js
// Pure Steering-Funktionen – KEIN "this" drin.

function v(x=0,y=0){ return new Phaser.Math.Vector2(x,y); }
function limit(vec, max){ if(vec.lengthSq()>max*max){ vec.setLength(max); } return vec; }

function seek(from, to, maxSpeed){
  const d = v(to.x-from.x, to.y-from.y);
  return d.normalize().scale(maxSpeed);
}

function arrive(from, to, maxSpeed, arriveRadius=120){
  const d = v(to.x-from.x, to.y-from.y);
  const dist = d.length();
  if (dist === 0) return v();
  const t = Phaser.Math.Clamp(dist/arriveRadius, 0, 1);
  return d.scale((t*maxSpeed)/dist); // weicher slowdown
}

function separation(me, neighbors, radius=90, strength=1){
  const steer = v();
  let count = 0;
  neighbors.forEach(n=>{
    if(n===me || !n.active) return;
    const dx = me.x - n.x, dy = me.y - n.y;
    const d2 = dx*dx+dy*dy;
    if (d2>0 && d2 < radius*radius){
      steer.x += dx/d2; // stärker je näher
      steer.y += dy/d2;
      count++;
    }
  });
  if (count>0) steer.scale(strength);
  return steer;
}

function cohesion(me, neighbors, radius=220, strength=1){
  // Richtung zum lokalen Massenzentrum
  let cx=0, cy=0, count=0;
  neighbors.forEach(n=>{
    if(n===me || !n.active) return;
    const dx=n.x-me.x, dy=n.y-me.y;
    if (dx*dx+dy*dy < radius*radius){ cx+=n.x; cy+=n.y; count++; }
  });
  if(!count) return v();
  cx/=count; cy/=count;
  return seek(me, {x:cx,y:cy}, strength); // hier "strength" als Pseudo‑speed
}

function obstacleAvoidance(me, obstacles, aheadDist=80){
  // einfacher „Feeler“ nach vorn: weiche ab, wenn ein Hindernis nahe der Bahn liegt
  if (!obstacles) return v();
  const dir = v(me.body.velocity.x, me.body.velocity.y);
  if (dir.lengthSq() < 1) return v();

  const ahead = v(me.x, me.y).add(dir.clone().normalize().scale(aheadDist));
  let closest=null, minD2=Infinity;

  obstacles.children?.iterate(o=>{
    if(!o) return;
    const b = o.getBounds();
    // Distanz Punkt->Rect
    const px = Phaser.Math.Clamp(ahead.x, b.left, b.right);
    const py = Phaser.Math.Clamp(ahead.y, b.top,  b.bottom);
    const dx = ahead.x - px, dy = ahead.y - py;
    const d2 = dx*dx+dy*dy;
    if(d2 < minD2){ minD2=d2; closest=o; }
  });

  if (!closest) return v();

  // Weglenken: von Hindernis‑Center weg
  const cb = closest.getBounds();
  const center = v((cb.left+cb.right)/2, (cb.top+cb.bottom)/2);
  const away = v(me.x - center.x, me.y - center.y);
  if (away.lengthSq()===0) return v();
  return away.normalize().scale(120); // „Stärke“ der Vermeidung
}

function hasLineOfSight(from, to, obstacles){
  if(!obstacles) return true;
  const line = new Phaser.Geom.Line(from.x, from.y, to.x, to.y);
  let blocked = false;
  obstacles.children?.iterate(o=>{
    if(blocked || !o) return;
    const r = o.getBounds();
    if (Phaser.Geom.Intersects.LineToRectangle(line, r)) blocked = true;
  });
  return !blocked;
}

window.Steering = {
  seek, arrive, separation, cohesion, obstacleAvoidance, hasLineOfSight, v, limit
};