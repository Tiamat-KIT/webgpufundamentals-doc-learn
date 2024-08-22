document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas></canvas>
`;

async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter!.requestDevice();
  if (!device) {
    throw new Error('対応ブラウザではありません');
  }
  const canvas = document.querySelector('canvas')!;
  const context = canvas.getContext('webgpu')!;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  // "rgba8unorm"か"bgra8unorm"のどちらか、そのシステムにおいて最適な方が選ばれている
  context.configure({
    device,
    format: presentationFormat,
  });
  // 取得したデバイスと、WebGPUコンテキストが関連付けられる
  const module = device.createShaderModule({
    label: 'our hardcoded red triangle shaders',
    // WGSLという言語を記述
    code: `
    @vertex fn vs(
      @builtin(vertex_index) vertexIndex : u32
    ) -> @builtin(position) vec4f {
      let pos = array(
        vec2f( 0.0,  0.5),  // top center
        vec2f(-0.5, -0.5),  // bottom left
        vec2f( 0.5, -0.5)   // bottom right
      );

      return vec4f(pos[vertexIndex], 0.0, 1.0);
    }

    @fragment fn fs() -> @location(0) vec4f {
      return vec4f(1.0, 0.0, 0.0, 1.0);
    }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    // データのレイアウトをシェーダの内容から
    // 自動で設定させる
    layout: 'auto',
    vertex: {
      module,
      // どの関数をシェーダとして使うかを指定
      entryPoint: 'vs',
    },
    fragment: {
      module,
      // どの関数をシェーダとして使うかを指定
      entryPoint: 'fs',
      // レンダーターゲットを指定
      // これは書き込み先のテクスチャのこと
      // パイプラインを生成し、その書き出し先となる、
      // テクスチャのフォーマットを指定する必要がある

      // この配列の最初の要素がlocation(0)に対応する
      targets: [{ format: presentationFormat }],
    },
  });

  // 描画先とするTextureの指定と
  // そのTextureをどう扱うかの設定
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',

    // この配列は描画対象となるテクスチャ
    // また、各Textureをどう扱うかということも
    // 書いてある

    // 描画対象となるテクスチャの設定は保留し、
    // 各テクスチャをどう扱うかの設定を行っている
    colorAttachments: [
      {
        // 単一の背景色を指定する
        clearValue: [0.3, 0.3, 0.3, 1],
        // 描画開始前にTexture全体を背景色でクリア
        // その時点のテクスチャの内容をGPUにロードし、
        // そこに上書きで描画していく
        loadOp: 'clear',
        // 描画内容をTextureに保存する
        // "discard"なら内容を破棄する
        storeOp: 'store',
      },
    ] as Iterable<GPURenderPassColorAttachment>,
  };
  function render() {
    // CanvasコンテキストからカレントTextureを得る
    // それをレンダーパスに設定し、描画対象として設定する
    // colorAttachmentsの要素にcanvasのテクスチャを設定する
    const FirstColorAttachment =
      renderPassDescriptor.colorAttachments[Symbol.iterator]().next().value;
    FirstColorAttachment.view = context.getCurrentTexture().createView();

    // コマンドエンコーダを生成する。コマンドのエンコードが可能な状態とする
    const encoder = device.createCommandEncoder({
      label: 'our encoder',
    });

    /// レンダーパスのエンコーダを生成、そこへコマンドを並べて、描画手順をエンコード
    // レンダーパスエンコーダは、レンダリング関連のコマンドを
    // 生成することに特化したエンコーダ
    // renderPassDescriptorを渡して描画対象とするTextureを指定
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.draw(3);
    // セットしたパイプラインを3回実行。
    // 三回実行されるたびに、3つの頂点シェーダが返した3つの点を結ぶ三角形を描画
    pass.end();

    const commandBuffer = encoder.finish();
    // コマンドを並べて定義した手順が入ったコマンドバッファが得られる
    device.queue.submit([commandBuffer]);
  }
  render();
}

main();
