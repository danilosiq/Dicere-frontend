"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/core/components/button";
import { InputText } from "@/core/components/input-text";
import { Column, Row } from "@/core/components/layout";

import { createRoomSchema, type CreateRoomSchemaType } from "./schema";

export type CreateRoomFormProps = {
  onCancel?: () => void;
  onSubmit?: (data: CreateRoomSchemaType) => void | Promise<void>;
};

export function CreateRoomForm({ onCancel, onSubmit }: CreateRoomFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoomSchemaType>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      title: "",
      nickname: "",
      password: "",
    },
  });

  async function handleCreateRoom(data: CreateRoomSchemaType) {
    await onSubmit?.(data);
  }

  return (
    <form onSubmit={handleSubmit(handleCreateRoom)} className="w-full">
      <Column className="w-full gap-3">
        <InputText
          label="Título da sala"
          placeholder="Título da sala"
          error={errors.title?.message}
          required
          {...register("title")}
        />
        <InputText
          label="Seu nome"
          placeholder="Seu nome"
          error={errors.nickname?.message}
          required
          {...register("nickname")}
        />
        <InputText
          label="Senha"
          placeholder="Senha"
          type="password"
          error={errors.password?.message}
          required
          {...register("password")}
        />

        <Row className="mt-5 justify-end gap-3">
          <Button
            label="Cancelar"
            variant="ghost"
            rounded="sm"
            type="button"
            onClick={onCancel}
          />
          <Button
            label="Confirmar"
            rounded="sm"
            type="submit"
            loading={isSubmitting}
          />
        </Row>
      </Column>
    </form>
  );
}
