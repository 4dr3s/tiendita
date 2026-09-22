import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 3001);
  await app.listen(port);
  console.log(`TIENDITA api listening on http://localhost:${port}`);
}

void bootstrap();