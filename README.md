# Prototipo de Organigrama Radial — Renderizando 10,000 Usuarios

## Disclaimer

> ** Esto es únicamente una prueba de concepto construida con fines experimentales.**

No es una implementación lista para producción. Después de investigar en **“D3.js in Action, Third Edition”**, quise poner a prueba sus principios de rendimiento en un escenario extremo. Elegí renderizar un organigrama radial con **10,000 usuarios** como caso de estrés.

**Importante tener en cuenta:**

* No es una visualización responsive
* Todo está contenido en un solo componente de más de 900 líneas
* No hay tests, ni documentación (puse comentarios para que se entienda mejor)
* Es código experimental que **no debería usarse en producción**

No fue desarrollado con un caso de uso real en mente, pero podría servir como punto de partida o referencia técnica para alguien que enfrente desafíos similares.

---

## ¿Qué estaba intentando probar?

El libro argumenta que muchos desarrolladores usamos D3 de forma incorrecta, manipulando el DOM directamente y generando visualizaciones que se degradan rápidamente con grandes volúmenes de datos. Quise comprobar si aplicando sus principios correctamente se podía construir una visualización masiva eficiente.

### Principios clave que implementé

1. **Canvas > SVG para renderizado a gran escala**

   * SVG genera un nodo del DOM por elemento
   * Canvas dibuja todo en un bitmap

2. **D3 para cálculos, no para manipulación del DOM**

   * `d3.hierarchy()` para estructurar los datos
   * `d3.cluster()` para calcular posiciones radiales
   * Vue gestiona el DOM y el estado reactivo

3. **Animaciones personalizadas con `requestAnimationFrame`**

   * Evité `d3.transition()` por su sobrecarga
   * Control manual de easing y tiempos

4. **Arquitectura híbrida Vue + D3**

   * Vue para el ciclo de vida y reactividad
   * D3 como librería de utilidades

---

## Lo que funcionó (por suerte bien)

* ✅ Renderiza más de 10,000 nodos sin lags críticos
* ✅ Zoom y pan en tiempo real, de forma bastante fluida
* ✅ Animaciones suaves en expandir/colapsar nodos
* ✅ Tooltips responsivos al hover
* ✅ Detección de clics precisa en Canvas
* ✅ Auto-zoom inteligente según el tamaño del dataset

---

## Lo que hay que mejorar (como era de esperarse)

* ❌ No es responsive (dimensiones fijas)
* ❌ Código espagueti difícil de mantener
* ❌ Eventos de mouse sin debouncing
* ❌ Datos y configuraciones hardcodeados

---

## Observaciones de rendimiento

Durante las pruebas, medí los siguientes tiempos de renderizado inicial:

| Nodos   | Tiempo de Render Inicial          | Interacción   |
| ------- | --------------------------------- | ------------- |
| 1,000   | \~50ms                            | Fluido        |
| 5,000   | \~200ms                           | Pequeños lags |
| 10,000  | \~500ms                           | Usable        |
| 20,000+ |    Comienzan los problemas        |               |



### Caching y optimización

```js
const NODE_CACHE = new Map(); // Reutilizar objetos
const RENDER_THROTTLE_MS = 16; // Cap a ~60fps
const BRANCH_COLORS = [...]; // Colores precalculados
```

### Canvas optimizado

* Uso de `Path2D` para formas complejas (más rápido)
* Una sola transformación por frame
* Renderizado en batches (enlaces primero, nodos después)


### Animaciones personalizadas

```js
function animateNodes(nodes, source) {
  const startTime = performance.now();
  function animate(currentTime) {
    const progress = (currentTime - startTime) / ANIMATION_DURATION;
    const eased = 1 - Math.pow(1 - progress, 3);
    // Interpolaciones y redibujado...
    requestAnimationFrame(animate);
  }
}
```

### Detección de colisiones manual

Canvas no tiene eventos individuales por elemento:
Esto no está pulido
```js
function getNodeAtPosition(x, y) {
  return nodes.find(node => {
    const [nodeX, nodeY] = radialPoint(node.x, node.y);
    return Math.abs(x - nodeX) <= cardWidth / 2;
  });
}
```

---

## Estructura de datos 

```js
{
  name: "CEO",
  position: "Chief Executive Officer",
  level: 0,
  isManagerial: true,
  headcount: { active: 150, inactive: 5, open: 10, total: 165 },
  children: [
    {
      name: "CTO",
      position: "Chief Technology Officer",
      level: 1,
      children: [...]
    }
  ]
}
```

---

## Aprendizajes: teoría vs. práctica

**Lo que el libro tenía razón:**

* Canvas es significativamente más eficiente que SVG en escalas grandes
* `d3.transition()` puede ser innecesario
* Separar cálculos de renderizado mejora el rendimiento
* Cachear todo lo posible es fundamental

**Lo que me sorprendió:**

* La detección de eventos en Canvas es más compleja de lo esperado
* Renderizar texto en Canvas es más lento de lo que imaginaba
* Implementar zoom/pan personalizado implica bastante trabajo

---

## ¿Qué haría diferente si esto fuera para producción?

1. **Modularizar** — Separar en múltiples composables y utilidades
2. **Virtualizar** — Renderizar solo lo visible en el viewport
3. **Web Workers** — Mover cálculos pesados fuera del hilo principal, vi que se recomienda mucho
4. **Debouncing** — Optimizar eventos de mouse y scroll
5. **Pooling de memoria** — Reutilizar objetos en vez de crear nuevos
6. **Level of Detail** — Reducir detalle visual en niveles de zoom bajos
7. **Responsive** — Adaptar el layout a distintos tamaños de pantalla

---

## Cómo ejecutar la prueba

```bash
npm install
npm run dev
```

Luego:

* Acceder a la página del organigrama
* Usar botones para expandir/colapsar ramas
* Usar la rueda del mouse para hacer zoom
* Hacer drag para mover el canvas
* Hover para tooltips

---

## Conclusión final

Este experimento demostró que D3 puede ser usado de forma mucho más eficiente si se respetan sus principios fundamentales. Sin embargo, también mostró que la complejidad de mantener ese rendimiento crece de forma exponencial.
Si alguien necesita algo parecido en un caso real, puede que esto le sirva como punto de partida.
