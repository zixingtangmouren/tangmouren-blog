## 前言

最近在咱们社区看到一位大佬的这篇文章[Vue 组件通信方式及其应用场景总结](https://juejin.cn/post/6903796293445877773)，感觉对`vue2`的通信方式和应用场景总结的非常到位，所以向大佬 salute😄。刚好最近在学习`vue3`，于是也思考总结一下在`vue3`中的组件通信的方式。

我们知道`vue3`的`Composition Api`是它几个最大亮点之一，所以下文都是在`setup`中演示代码的实现。后面会以开发几个简单`form组件`为例子来演示。

## 基本操作

这里先简单开发一个`VInput`的输入框组件。组件就像一个函数，主要就是处理输入和输出。`Vue3`在`setup`函数上提供了两个参数，一个`props`，一个是`context`下面的`emit`方法，分别来处理输入和输出。

### props

现在`VInput`就是子组件，我需要它能够接受父级传递一个值，让它可以帮我做后续的逻辑处理在返回给父级。所以，这里需要最基本的一些父子通信方式`v-bind`，`props`。

**父级组件中**

```ts
<template>
   // 通过v-bind将数据想子组件传递
  <VInput :value="valueRef" />
</template>

const valueRef = ref('')
```

**VInput 中**

```ts
<template>
  <input :value="value" type="text" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'VInput',
  props: {
    value: String
  },
  setup(props) {
    // 其他逻辑

    // 接受到这个值
    console.log(props.value)
    return {}
  }
})
</script>
```

### emit

当我们在组件中接受参数，进行一些逻辑处理后，我们就需要将处理好的值，向外部进行一个返回，外部同时需要实现一个事件函数去接受。此时我就可以使用`emit`方法

假设我们希望`VInput`组件返回给外部的是一个限制长度的字符串。此时外部就需要实现一个对应的事件函数去接收这个值，然后`VInput`内部通`emit`执行事件，将内部的处理好的值当做参数返回出去。

**VInput**

```ts
<template>
  <input :value="value" type="text" @input="onInput" ref="inputRef" />
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'VInput',
  props: {
    value: String,
    maxLength: Number
  },
  setup(props, { emit }) {
     // Vue3中获取组件或者dom实例的一种方式
    const inputRef = ref()

    // 限制文字长度
    const limitLength = (value: string, maxLength: number) =>
      value.slice(0, maxLength)


    // 输入控制
    const controlled = (value: string) => {
      inputRef.value.value = value
    }

    const onInput = (e: any) => {
      let value = e.target.value

      if (typeof props.maxLength === 'number' && props.maxLength >= 0) {
        value = limitLength(value, props.maxLength)
      }

      controlled(value)

      // 向外部返回一个处理过的值
      emit('onInput', value)
    }
    return {
      onInput,
      inputRef
    }
  }
})
</script>
```

**父级组件**

```ts
<template>
  // 通过v-on向子组件传递一个函数，用户接受返回值
  <VInput :value="valueRef" :maxLength="10" @onInput="onInput" />
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import VInput from '@/components/VInput.vue'

export default defineComponent({
  name: 'Demo',
  components: {
    VInput
  },
  setup() {
    const valueRef = ref('')

    const onInput = (value: string) => {
       // 接受子组件VInput返回的值
      console.log(value)
      // 改变对应的值
      valueRef.value = value
    }

    return {
      valueRef,
      onInput
    }
  }
})
</script>
```

对于这种`input`的组件的使用，我猜大家肯定都不想在父级组件这么麻烦的去接收和改变一个值，所以`vue`是提供了`v-model`来更快捷的实现输入和输出。

### v-model

通过`Vue3`的文档可以发现，这个指令的用法发生了一定的变化。在之前，我们要想实现一个**自定义的非表单组件**的双向绑定，需要通过`xxxx.sync`的这种语法来实现，如今这个指令已经被废除了，而是统一使用`v-model`这个指令。

**父级组件**

新的`v-model` 还可以支持多个数据的双向绑定。

```ts
<template>
  <VBtn v-model:value="valueRef" v-model:keyword="keywordRef" />
</template>
```

**自定义的非表单组件**

```ts
<template>
  <button @click="clickHandle">click</button>
</template>

export default defineComponent({
  name: 'VBtn',
  props: {
    value: String,
    keyword: String
  },
  setup(props, { emit }) {
     // 省略其他代码

     // 用户点击按钮
    const clickHandle = (e: any) => {
      // 省略其他代码

      // 修改对应的props的数据
      emit('update:value', value)
      emit('update:keyword', value + '123')
    }

    return {
      // ...
    }
  }
})

```

以上就是在`Vue3`中一些基本通信方式的 API 的介绍。在`Vue3`中一般都是采用`Composition Api`的形式开发，所以你会发现开发的时候不能在采用`this.$xxx`的方式去调用实例上的某个函数或者是属性。那些`this.$parent`，`this.$children`，`this.$on`，`this.$emit`等等都不能在使用了。

那在`Vue3`中如何解决组件间那些通信的呢？咱们从简单到复杂的场景，一个个来分析。

先来看一下，开发的三个`form`组件，组合起来的实际的用法是怎么样的:

```ts
<template>
  <ValidateForm ref="validateFormRef1" :model="state" :rules="rules">
    <ValidateFormItem label="用户名" prop="keyword">
      <ValidateInput
        placeholder="请输入"
        required
        v-model:modelValue="state.keyword"
      />
    </ValidateFormItem>
    <ValidateFormItem label="密码" prop="password">
      <ValidateInput
        placeholder="请输入"
        required
        type="password"
        v-model:modelValue="state.password"
      />
    </ValidateFormItem>
  </ValidateForm>
  <button class="btn btn-primary" @click="submit(0)">提交</button>
</template>
```

所有组件的功能，是模仿`Element UI`去实现的。

## 父传子

父组件向子组件传递一个数据，可以用这两种方式：

- v-bind
- refs 获取子组件内部某个函数，直接调用传参（这里简称 refs 方式）

### refs 方式

关于`v-bind`咱们就不细说了，在基本操作章节已经讲过其对应的使用方式了。这小节主要在中讲`Vue3`如何通过`ref`获取子组件实例并调用其身上的函数来对子组件进行传值。

**子组件**

```ts
<template>
  // 渲染从父级接受到的值
  <div>Son: {{ valueRef }}</div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'Son',
  setup() {
    const valueRef = ref('')

    // 该函数可以接受父级传递一个参数，并修改valueRef的值
    const acceptValue = (value: string) => (valueRef.value = value)

    return {
      acceptValue,
      valueRef
    }
  }
})
</script>
```

**父组件**

```ts
<template>
  <div>sonRef</div>
  <button @click="sendValue">send</button>
  // 这里ref接受的字符串，要setup返回的ref类型的变量同名
  <Son ref="sonRef" />
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import Son from '@/components/Son.vue'

export default defineComponent({
  name: 'Demo',
  components: {
    Son
  },
  setup() {
    // 如果ref初始值是一个空，可以用于接受一个实例
    // vue3中获取实例的方式和vue2略有不同
    const sonRef = ref()

    const sendValue = () => {
      // 可以拿到son组件实例，并调用其setup返回的所有信息
      console.log(sonRef.value)

      // 通过调用son组件实例的方法，向其传递数据
      sonRef.value.acceptValue('123456')
    }

    return {
      sonRef,
      sendValue
    }
  }
})
</script>
```

这里可以看一下流程图：
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1dad085f528c47a49fee4ee2daa3f177~tplv-k3u1fbpfcp-watermark.image)
其实这种方式跟`Vue2`中使用`this.$refs`，`this.$children`的方式很相似，都是通过拿到子组件实例，直接调用子组件身上的函数。方法千篇一律，不过在`Vue3`中没有了`this`这个黑盒。

这里我们可以在控制台看一下这个`sonRef.value`是一个怎样的东西。

![](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e60113a245aa407090ceb65b280c09ea~tplv-k3u1fbpfcp-watermark.image)

可以发现，通过`ref`获取到的子组件实例上面可以拿到`setup`返回的所有变量和方法，同时还可以拿到其他的一些内部属性。我们可以看一下官方文档[Vue 组合式 API](https://vue-composition-api-rfc.netlify.app/zh/api.html#%E6%A8%A1%E6%9D%BF-refs)的描述。

> 在 Virtual DOM patch 算法中，如果一个 VNode 的 ref 对应一个渲染上下文中的 ref，则该 VNode 对应的元素或组件实例将被分配给该 ref。 这是在 Virtual DOM 的 mount / patch 过程中执行的，因此模板 ref 仅在渲染初始化后才能访问。

**ref 方式总结**

优点：

1. 父组件可以获取快速向**确定存在的**子组件传递数据
2. 传递的参数不受限制，传递方式比较灵活

缺点：

1. ref 获取的子组件必须确定存在的（不确定存在的情况：如插槽上子组件，`v-if`控制的子组件）
2. 子组件还需要实现接受参数的方法

## 父传更深的后代

一般往深度层级传递值，有这两种方式：

- provide / inject
- vuex

### provide / inject

一看到“深”这个字，大家肯定第一想到的就`Vue2`中的`provide / inject`选项。没错，这套逻辑在`vue3`中同样适用，这两个选项变成了两个方法。

`provide`允许我们向当前组件的所有后代组件，传递一份数据，所有后代组件能够通过`inject`这个方法来决定是否接受这份数据。

大致的示意图如下：
![](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ab59c36dfe594131a5f3fb7734ee92c6~tplv-k3u1fbpfcp-watermark.image)

**实际应用场景**

主要应用的场景有两中，一种深度传递一个参数或者一个函数的时候，另一种是给插槽上不确定性的组件传参的时候。

重点说一下给插槽上的组件传参。先实现一个最外层的`ValidateForm`组件，它主要负责接受一整个表单数据和整个表单数据的校验规则。其内部提供了一个插槽，用于放置一些不确定性的组件。还有一个`ValidateFormItem`组件可以接受一个字段名，通过这字段名准确知道需要校验哪个字段（tips:功能其实和`element-ui`类似）。

组件化开发，需要将参数和功能进行解耦，所以我们这样来设计：

- `ValidateForm`：`model`，`rules`，只管接受整份表单的数据和校验规则
- `ValidateFormItem`：`prop`，只管接受字段名，只需知道自己需要验证哪一个字段

```ts
<template>
  <ValidateForm ref="validateFormRef" :model="formData" :rules="rules">
    <ValidateFormItem label="用户名" prop="keyword">
      <!-- field组件 -->
    </ValidateFormItem>
    <ValidateFormItem label="密码" prop="password">
      <!-- field组件 -->
    </ValidateFormItem>
  </ValidateForm>
</template>
```

如果`ValidateFormItem`组件需要通过`prop`去效验某个字段，那它就需要拿到那份表单的数据，通过`formData[prop]`去取到那个字段的值，那这份`formData`从哪里来呢？首先不可能每写一个`ValidateFormItem`组件都传递一份。因为，实际开发中我们并不能确定在`ValidateForm`下要写多少个`ValidateFormItem`组件，如果每写一个都手动传递一份表单的数据，这些写起来就会多了很多冗余的代码而且也很麻烦。所以，就由`ValidateForm`这个组件独立接受并分发下来。

**ValidateForm**

所以我们需要`ValidateForm`来向下分发数据。

```ts
<template>
  <form>
    <slot></slot>
  </form>
</template>

<script lang="ts">
import { defineComponent, provide } from 'vue'

export const modelKey = Symbol()
export const rulesKey = Symbol()


export default defineComponent({
  name: 'ValidateForm',
  props: {
    model: {
      type: Object
    },
    rules: {
      type: Object
    }
  },
  setup(props) {
    // 向后代发放数据
    provide(modelKey, props.model)
    provide(rulesKey, props.rules)

    return {}
  }
})
</script>
```

**ValidateFormItem**

`ValidateFormItem`接受上面传递的数据。

```ts
<script lang="ts">
import { defineComponent, reactive, inject, provide } from 'vue'
import { modelKey, rulesKey } from './ValidateForm.vue'


export default defineComponent({
  name: 'ValidateFormItem',
  props: {
    label: String,
    required: {
      type: Boolean,
      default: false
    },
    prop: String
  },
  setup(props) {
    // 接受ValidateForm传下来的数据
    const model = inject<any>(modelKey, ref({}))
    const rules = inject<any>(rulesKey, ref({}))

    // 根据props.prop在model和rules分别取出需要 校验的数据 和 校验的规则
    console.log(model[props.prop])
    console.log(rules[props.prop])
    // 数据校验的逻辑

    return {
      //...
    }
  }
})
</script>
```

**provide / inject 总结**

在这篇文章[Vue 组件通信方式及其应用场景总结](https://juejin.cn/post/6903796293445877773)中，大佬对其的优缺点已经总结很好了。这里提一下它的缺点，就是不能解决兄弟组件的通信。

### vuex

`vuex`一直以来是`vue`生态中一个解决不同层级组件数据共享的优质方案。不仅是在父传子中可以适用，在子传父，或者祖先传后代，后代传祖先，兄弟组件间都是一个非常好的方案。因为它是一个集中状态管理模式。其本质实现也是响应式的。这里只简单提一下`Vue3`中是如何使用的。

**创建一个`store`**

```ts
import { createStore } from 'vuex'

export enum Mutarions {
  SET_COUNT = 'SET_COUNT',
}

export default createStore({
  state: {
    count: 231,
  },
  getters: {
    count: (state) => state.count,
  },
  mutations: {
    [Mutarions.SET_COUNT]: (state, num: number) => (state.count = num),
  },
})
```

**父组件**

```ts
<template>
  <div>father</div>

  <Son ref="sonRef" />
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import Son from '@/components/Son.vue'
import { useStore } from 'vuex'
import { Mutarions } from '@/store/index'

export default defineComponent({
  name: 'Father',
  components: {
    Son
  },
  setup() {
    const valueRef = ref(100)

    const store = useStore()

    store.commit(Mutarions.SET_COUNT, valueRef.value)

    return {}
  }
})
</script>
```

**子组件**

```ts
<template>
  <div>Son: {{ count }}</div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useStore } from 'vuex'

export default defineComponent({
  name: 'Son',
  setup() {
    const store = useStore()
    const count = computed(() => store.getters.count)

    return {
      count
    }
  }
})
</script>
```

## 子传父

子级向父级传递数据，可以有这三种方式：

- v-on
- refs 方式
- 事件中心

### refs 方式

通过`ref`的方式向父级传递一个数据是同样适用的。具体思路：子组件内部实现一个函数，该函数可以返回一个值。父级组件通过`ref`取到子组件实例后调用该方法，得到需要的返回值。

这里来看一下实际的应用场景，我们希望`ValidateForm`组件去验证下面所有的表单项，然后通过一个函数将组件内部的一个验证状态返回出去。

**父组件**

```ts
<template>
  <ValidateForm ref="validateFormRef" :model="formData" :rules="rules">
    <ValidateFormItem label="用户名" prop="keyword">
      <!-- field组件 -->
    </ValidateFormItem>
    <ValidateFormItem label="密码" prop="password">
      <!-- field组件 -->
    </ValidateFormItem>
  </ValidateForm>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'demo',
  setup() {
    // 省略部分代码

    const validateFormRef = ref()

    // 通过validate拿到ValidateForm组件内部的一个验证状态
    if (this.validateFormRef.validate()) {
      // 表单验证成功后，做后续的操作
    }

    return {
      validateFormRef
    }
  }
})
</script>
```

**ValidateForm**

```ts
<template>
  <form>
    <slot></slot>
  </form>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ValidateForm',
  setup() {
    const validate = async () => {
      let result = false
      // 调用插槽下所有ValidateFormItem组件内部的校验方法
      //（tips:至于如何调用，后面的事件中心会重点说）
      // 如果有一个校验方法返回的是false就直接返回false
      // 如果都为true就返回一个true

      return result
    }

    return {
      validate
    }
  }
})
</script>
```

这里来看一下大致的流程图：

![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/17111a8ec61c46a193e6177d5a25cdcd~tplv-k3u1fbpfcp-watermark.image)

通过该种方法还可以拿到子组件内部的数据，这就跟闭包函数一样的道理。

### 事件中心

这种通信方式为什么拿到这里来讲呢？因为我觉接下的实际案例用上事件中心这种方式会非常的恰当。在上一个小节中，我们留下来一个坑，那就是`ValidateForm`组件要去验证整个表单是否通过，就必须想办法让每个`ValidateFormItem`将内部的校验结果返回给它。

**首先会遇到两个问题**

1. `ValidateForm`下面的组件是通过插槽去挂载的，所以无法通过`ref`的方式去拿到每个子表单项的实例，所以就没办法拿到每个`ValidateFormItem`的验证状态了。
2. 上面的章节中有一个图片，展示了通过`ref`拿到的组件实例。可以发现，你可以找到`$parent`属性，但是没有`$children`属性。这就很尴尬了，我们没办法像`Vue2`一样在`ValidateForm`中通过`$children`拿到每个子组件的实例。

**解决思路**

既然没有办法拿到插槽上的组件实例，那咱们就绕开它，通过一个事件中心的方式来解决。思路是这样的：

1. 在`ValidateForm`实例初始化的时候，去创建一个事件中心`Emitter`实例，它可以注册一个事件，当这个事件被执行时可以接受一个函数，并存在一个队列中。
2. 将这个`Emitter`通过`provide`传递给后代，保证这个事件中心在不同的`ValidateForm`组件中都是独立的。换句话说，就是如果写了多个`ValidateForm`，他们的事件中心不会相互干扰。
3. 在`ValidateFormItem`中使用`inject`接收自己所在表单域的`Emitter`，在挂载的时候，执行`Emitter`上的事件，将自己的内部的`validate`函数，传递发送给`ValidateForm`，并由其将方法缓存在队列中。
4. `ValidateForm`执行校验的时候，就可以执行队列中的所有校验函数，并得出校验结果。

具体代码实现：

先来实现一个`Emitter`事件中心的类

```ts
import { EmitterHandles } from '@/type/utils'

export class Emitter {
  // 存放事件函数
  private events: EmitterHandles = {}

  // 用于注册事件
  on(eventName: string, eventHandle: Function) {
    this.events[eventName] = eventHandle
  }

  // 删除事件
  off(eventName: string) {
    if (this.events[eventName]) {
      delete this.events[eventName]
    }
  }

  // 触发事件
  emit(eventName: string, ...rest: any[]) {
    if (this.events[eventName]) {
      this.events[eventName](...rest)
    }
  }
}
```

当事件中心实现好了，这里来完善一下`ValidateForm`的代码

```ts
<script lang="ts">
import { defineComponent, nextTick, provide } from 'vue'
import { Emitter } from '@/utils/emitter'

type ValidateFunc = () => boolean

export const emitterKey = Symbol()
export const modelKey = Symbol()
export const rulesKey = Symbol()


export default defineComponent({
  name: 'ValidateForm',
  props: {
    model: {
      type: Object
    },
    rules: {
      type: Object
    }
  },
  setup(props) {
    // 将表单数据和验证规则传递给后代
    provide(modelKey, props.model)
    provide(rulesKey, props.rules)

    // 创建事件中心的实例
    const emitter = new Emitter()
    // 将事件中心传递给后代
    provide(emitterKey, emitter)

    // 接受formItem组件返回的验证函数
    // 并且将其存起来
    emitter.on('acceptValidate', (validateFunc: ValidateFunc) => {
      validateList.push(validateFunc)
    })

    // 用于接受保存后代返回的验证方法
    const validateList: ValidateFunc[] = []

    // 验证所有数据的状态
    const validate = () => {
      // 执行每一个子表单发送过来的验证方法
     return validateList.map(fn => fn()).every(valid => valid)
    }

    return {
      validate
    }
  }
})
</script>
```

ok，现在实现了`validateForm`的逻辑，我们再来写一下`validateFormItem`的逻辑

```ts
<template>
  <div class="form-group">
    <label v-if="label" class=" col-form-label">{{ label }}</label>
    <slot></slot>
    <small v-if="error.isError" class="invalid-feedback">
      {{ error.errorMessage }}
    </small>
  </div>
</template>

<script lang="ts">
import { Emitter } from '@/utils/emitter'
import { defineComponent, reactive, inject, onMounted, provide } from 'vue'
import { emitterProviderKey, modelKey, rulesKey } from './ValidateForm.vue'

export default defineComponent({
  name: 'ValidateFormItem',
  props: {
    label: String,
    required: {
      type: Boolean,
      default: false
    },
    prop: String
  },
  setup(props) {
    // 接受Emitter事件中心
    const emitter = inject<Emitter>(emitterProviderKey)
    // 接受数据和校验规则
    const model = inject<any>(modelKey)
    const rules = inject<any>(rulesKey)

    const error = reactive({
      isError: false,
      errorMessage: ''
    })

    // 校验对应的字段数据
    const validateField = () => {
      const prop = props.prop
      if (prop && model && rules && rules[prop]) {
        const result = rules[prop].some((item: any) => {
          if (!item.validator(model[prop])) {
            console.warn(`${prop}:${item.message}`)
            error.isError = true
            error.errorMessage = item.message
            return true
          }
        })
        return !result
      }
      return true
    }


    // 当组件挂载的时候，将自身的校验函数发送给ValidateForm组件
    onMounted(() => {
      emitter && emitter.emit('acceptValidate', validateField)
    })

    return {
      error
    }
  }
})
</script>
```

为了更详细的理解上面的过程，这里来画一个示意图：

1. 注册事件，分发事件中心

![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f8266bd8e41b4d1a9322b4d92f43ccc8~tplv-k3u1fbpfcp-watermark.image)

2. 执行事件，发送验证函数

![](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/57255b6f8a9f4f9bb6f51fd015891a46~tplv-k3u1fbpfcp-watermark.image)

整个过程的总结就是，顶层组件创建和分发事件中心，并注册事件监听函数。后代组件执行该事件然后发送信息，顶层组件回收信息。

**Tips**

这里再提一点，在使用`Emitter`这个事件中心的时候，是在`ValidateForm`的`setup`中去创建并且去下发的，并不是使用一个全局的事件中心。就像大佬的这篇文章[Vue 组件通信方式及其应用场景总结](https://juejin.cn/post/6903796293445877773)中总结到的，事件总线的形式是有一个致命缺点的，如果一个页面上有多个公共组件，我们只要向其中的一个传递数据，但是每个公共组件都绑定了数据接受的方法，那就会出现混乱的情况。但是，我们的事件总线不是一个全局的，而是单个作用域里面的一个事件中心。

因为事件中心是在当前组件内部创建，并使用`provide`向下发布的，这样就只有当前组件的后代才能使用这个事件中心。所以，就算一个面上写了多个`ValidateForm`，他们的校验都是独立的。

```ts
<template>
  <ValidateForm ref="validateFormRef1" :model="formData1" :rules="rules">
    <ValidateFormItem label="用户名" prop="keyword">
      <!-- field组件 -->
    </ValidateFormItem>
    <ValidateFormItem label="密码" prop="password">
      <!-- field组件 -->
    </ValidateFormItem>
  </ValidateForm>

    <ValidateForm ref="validateFormRef2" :model="formData2" :rules="rules">
    <ValidateFormItem label="用户名" prop="keyword">
      <!-- field组件 -->
    </ValidateFormItem>
    <ValidateFormItem label="密码" prop="password">
      <!-- field组件 -->
    </ValidateFormItem>
  </ValidateForm>
</template>
```

示意图：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dddce9e4d09a4db5b07dd33cefafdc0a~tplv-k3u1fbpfcp-watermark.image)

**事件中心总结**

优点：

1. 可以解决`Vue3`不能使用`this.$children`的问题
2. 可以灵活使用，不受组件层级的限制
3. 这种通信方式不受框架的限制

缺点：

1. 需要控制好事件中心的作用范围
2. 需要控制好事件名的规范

## 事件中心进阶

因为在`Vue3`的`Composition API`中，`vue`的功能 api 更加的颗粒化。我们可以对事件中心进行一个自定义需求的改造。

可以通过引入`reactive, ref`帮助我们的事件中心内部维护一个响应式的数据，可以实现当事件中心进行一定通信行为时，去更新对应的视图。还可以引入`computed`实现计算属性的功能。

```ts
import { reactive, ref, computed } from 'vue'

export class Emitter {
  // 响应式的数据中心
  private state = reactive({})
  private events: EmitterHandles = ref({})

  // 记录当前事件中心 事件的数量
  private eventLength = computed(() => Object.keys(events.value).length)

  // 省略部分代码
}
```

加入`watch,watchEffect`实现数据监听做出一定逻辑行为的功能。我认为`Composition API`和`React Hooks Api`都是非常强大，因为它们允许我们将功能函数当成积木一样去任意组装成我们希望得到的应用程序。

## 深层后代向顶层通信，兄弟通信

我觉得其实其他的场景，其通信方式基本都差不多了，所谓千篇一律。后代向祖先传值，或者兄弟组件传值，都可以使用`vuex`或者是`事件中心`的方式。兄弟层级，或者相邻层级的，就可以使用`ref`,`$parent`等方式。

## 最后

我个人对`Vue3`还是非常看好的，目前对于公司的部分旧项目，也思考如何去用`Vue3`去重构它。然后我也是因为刚好看了社区大佬的文章绝对非常有意思，于是来了兴趣写了一个`Vue3`通信总结 😂，可能还有很多地方说的不是很到位。

如果有错误或者是补充，欢迎大家在评论区留言，如果觉得还行对你有帮助就劳烦点个赞哈哈，🙏 谢谢各位靓仔靓女。
