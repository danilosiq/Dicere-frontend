"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/core/components/button";
import { InputText } from "@/core/components/input-text";
import { Column, Row } from "@/core/components/layout";
import { cn } from "@/core/utils/cn";

import { joinRoomSchema, type JoinRoomSchemaType } from "./schema";

export type JoinRoomFormProps = {
  onSubmit?: (data: JoinRoomSchemaType) => void | Promise<void>;
  onCancel?: () => void;
  initialRoomCode?: string;
  className?: string;
};

function maskRoomCode(value: string) {
  const cleanValue = value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 9);

  return cleanValue.match(/.{1,3}/g)?.join("-") ?? "";
}

export function JoinRoomForm({
  onSubmit,
  onCancel,
  initialRoomCode,
  className,
}: JoinRoomFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinRoomSchemaType>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: {
      roomCode: initialRoomCode ? maskRoomCode(initialRoomCode) : "",
      name: "",
      password: "",
    },
  });

  async function handleJoinRoom(data: JoinRoomSchemaType) {
    await onSubmit?.(data);
  }

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={handleSubmit(handleJoinRoom)}
    >
      <Column className="w-full gap-3">
        <InputText
          label="Código da sala"
          placeholder="Room code"
          mask={maskRoomCode}
          error={errors.roomCode?.message}
          required
          {...register("roomCode")}
        />
        <InputText
          label="Seu nome"
          placeholder="Name"
          error={errors.name?.message}
          autoComplete="name"
          required
          {...register("name")}
        />
        <InputText
          label="Senha"
          placeholder="Password"
          type="password"
          error={errors.password?.message}
          autoComplete="current-password"
          required
          {...register("password")}
        />

        <Row className="mt-5 justify-end gap-3">
          {onCancel && (
            <Button
              label="Cancelar"
              variant="ghost"
              rounded="sm"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            />
          )}
          <Button
            label="Confirmar"
            variant="secondary"
            rounded="sm"
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        </Row>
      </Column>
    </form>
  );
}
